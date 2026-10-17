/**
 * Port of `ComposeDocument` (Types/ComposeDocument.swift) and its extensions in
 * pkg/utils/compose (+Syntax, +Editing, +BlockScalars, +Native, +Networks).
 *
 * A source-backed YAML document: edits replace syntax ranges and never
 * re-serialize the document, so comments, quoting, spelling and line endings
 * of untouched YAML survive byte for byte. The syntax tree comes from
 * `yaml-syntax.ts` (tree-sitter shaped), so this ports nearly line for line.
 */
import { ComposeDocumentError, ComposeFormError } from './compose-errors';
import {
	isKey,
	type ComposeFieldPath,
	type ComposeNativeField,
	type ComposeNativeKind
} from './compose-native-field';
import { parseSyntax, SyntaxNode, YAMLSyntaxError } from './yaml-syntax';

type Range = { location: number; length: number };
const maxRange = (range: Range) => range.location + range.length;
type Edit = [Range, string];

/** `ComposeBlockScalar`: the semantic value and source extent of a literal or folded scalar. */
export type ComposeBlockScalar = {
	value: string;
	replacementRange: Range;
	indentation: number;
	parentIndentation: number;
	explicitIndentation: number | null;
	headerSuffix: string;
};

type CacheEntry = { source: string; result: { document: ComposeDocument } | { error: unknown } };

/** `ComposeDocumentParseCache`: recently parsed sources, most recent last. */
const parseCache = {
	capacity: 16,
	entries: [] as CacheEntry[],
	result(source: string) {
		const index = this.entries.findLastIndex((entry) => entry.source === source);
		if (index === -1) return undefined;
		const [entry] = this.entries.splice(index, 1);
		this.entries.push(entry!);
		return entry!.result;
	},
	store(result: CacheEntry['result'], source: string) {
		this.entries = this.entries.filter((entry) => entry.source !== source);
		this.entries.push({ source, result });
		if (this.entries.length > this.capacity)
			this.entries.splice(0, this.entries.length - this.capacity);
	}
};

const spaces = (count: number) => ' '.repeat(Math.max(0, count));
const leadingSpaces = (line: string) => line.length - line.replace(/^ +/, '').length;
const trimWhitespace = (value: string) => value.replace(/^\s+|\s+$/g, '');
const typeIs = (node: SyntaxNode | null | undefined, ...types: string[]) =>
	node != null && types.includes(node.type);

export class ComposeDocument {
	readonly source: string;
	readonly root: SyntaxNode;

	private constructor(source: string, root: SyntaxNode) {
		this.source = source;
		this.root = root;
	}

	/** `try ComposeDocument(source)`, reusing the result for recently parsed text. */
	static parse(source: string): ComposeDocument {
		const cached = parseCache.result(source);
		if (cached) {
			if ('document' in cached) return cached.document;
			throw cached.error;
		}
		try {
			const document = ComposeDocument.parsing(source);
			parseCache.store({ document }, source);
			return document;
		} catch (error) {
			parseCache.store({ error }, source);
			throw error;
		}
	}

	/** `try? ComposeDocument(source)`. */
	static tryParse(source: string): ComposeDocument | undefined {
		try {
			return ComposeDocument.parse(source);
		} catch {
			return undefined;
		}
	}

	private static parsing(source: string): ComposeDocument {
		let parsed;
		try {
			parsed = parseSyntax(source);
		} catch (error) {
			if (error instanceof YAMLSyntaxError)
				throw ComposeDocumentError.invalid(`Invalid YAML at line ${error.line}.`);
			throw ComposeDocumentError.invalid('Unable to parse YAML.');
		}
		const document = new ComposeDocument(source, parsed.root);
		if (parsed.documentCount > 1)
			throw ComposeDocumentError.invalid('Edit multi-document YAML in the YAML editor.');
		document.validateKeys(parsed.root);
		return document;
	}

	get services(): string[] {
		const path: ComposeFieldPath = [{ key: 'services' }];
		if (this.nativeField(path).kind !== 'mapping') return [];
		return this.nativeFields(path)
			.map((field) => field.name)
			.filter((name) => name !== '<<');
	}

	rawValue(path: readonly string[]): string | undefined {
		const node = this.resolve(path);
		return node ? this.fragment(node) : undefined;
	}
	scalar(path: readonly string[]): string | undefined {
		const node = this.resolve(path);
		if (!node || !ComposeDocument.isScalar(node)) return undefined;
		return ComposeDocument.decode(this.fragment(node));
	}
	value(path: readonly string[]): string | undefined {
		return this.scalar(path) ?? this.rawValue(path);
	}
	keys(path: readonly string[]): string[] {
		const node = this.resolve(path);
		const mapping = node ? ComposeDocument.mapping(node) : undefined;
		if (!mapping) return [];
		return this.pairs(mapping).flatMap((pair) => {
			const key = pair.childByFieldName('key');
			const decoded = key ? ComposeDocument.decode(this.fragment(key)) : undefined;
			return decoded === undefined ? [] : [decoded];
		});
	}
	items(path: readonly string[]): string[] | undefined {
		const node = this.resolve(path);
		if (!node) return undefined;
		const flow = ComposeDocument.flowSequence(node);
		if (flow) return ComposeDocument.flowItems(flow).map((item) => this.fragment(item));
		const sequence = ComposeDocument.sequence(node);
		if (!sequence) return undefined;
		return ComposeDocument.children(sequence)
			.filter((child) => child.type === 'block_sequence_item')
			.flatMap((item) => {
				const content = ComposeDocument.content(item);
				return content ? [this.fragment(content)] : [];
			});
	}
	isEditable(path: readonly string[]): boolean {
		try {
			this.editableTarget(path);
			return true;
		} catch {
			return false;
		}
	}

	static quoted(string: string): string {
		return JSON.stringify(string);
	}

	// MARK: - Syntax (ComposeDocument+Syntax.swift)

	get newline(): string {
		return this.source.includes('\r\n') ? '\r\n' : '\n';
	}
	range(node: SyntaxNode): Range {
		return { location: node.start, length: node.end - node.start };
	}
	substring(range: Range): string {
		return this.source.slice(range.location, maxRange(range));
	}
	fragment(node: SyntaxNode): string {
		const text = this.substring(this.range(node));
		const indent = this.column(node);
		return text
			.replace(/\r\n/g, '\n')
			.split('\n')
			.map((line, index) =>
				index === 0 ? line : line.slice(Math.min(indent, leadingSpaces(line)))
			)
			.join('\n');
	}
	lineStart(offset: number): number {
		let position = offset;
		while (position > 0 && this.source.charCodeAt(position - 1) !== 10) position -= 1;
		return position;
	}
	lineEnd(offset: number): number {
		if (offset > 0 && this.source.charCodeAt(offset - 1) === 10) return offset;
		let position = offset;
		while (position < this.source.length && this.source.charCodeAt(position) !== 10) position += 1;
		return position < this.source.length ? position + 1 : position;
	}
	column(node: SyntaxNode): number {
		const location = this.range(node).location;
		return location - this.lineStart(location);
	}
	static children(node: SyntaxNode): SyntaxNode[] {
		return node.namedChildren;
	}
	static content(node: SyntaxNode): SyntaxNode | undefined {
		if (
			['stream', 'document', 'block_node', 'flow_node', 'block_sequence_item'].includes(node.type)
		) {
			const first = ComposeDocument.children(node).find(
				(child) =>
					!['comment', 'anchor', 'tag', 'yaml_directive', 'tag_directive'].includes(child.type)
			);
			return first ? ComposeDocument.content(first) : undefined;
		}
		return node;
	}
	static mapping(node: SyntaxNode) {
		const content = ComposeDocument.content(node);
		return content?.type === 'block_mapping' ? content : undefined;
	}
	static sequence(node: SyntaxNode) {
		const content = ComposeDocument.content(node);
		return content?.type === 'block_sequence' ? content : undefined;
	}
	static flowSequence(node: SyntaxNode) {
		const content = ComposeDocument.content(node);
		return content?.type === 'flow_sequence' ? content : undefined;
	}
	static flowItems(node: SyntaxNode): SyntaxNode[] {
		return ComposeDocument.children(node).filter((child) => child.type !== 'comment');
	}
	flowCommas(node: SyntaxNode): SyntaxNode[] {
		return node.allChildren.filter((child) => child.type === ',');
	}
	static isScalar(node: SyntaxNode): boolean {
		const content = ComposeDocument.content(node);
		return (
			content !== undefined &&
			['plain_scalar', 'double_quote_scalar', 'single_quote_scalar'].includes(content.type)
		);
	}
	static decode(value: string): string | undefined {
		if (value.startsWith('"')) {
			try {
				const decoded: unknown = JSON.parse(value);
				return typeof decoded === 'string' ? decoded : undefined;
			} catch {
				return undefined;
			}
		}
		if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
			return value.slice(1, -1).replace(/''/g, "'");
		}
		return value;
	}
	pairs(mapping: SyntaxNode): SyntaxNode[] {
		return ComposeDocument.children(mapping).filter(
			(child) =>
				['block_mapping_pair', 'flow_pair'].includes(child.type) ||
				(mapping.type === 'flow_mapping' && child.type === 'flow_node')
		);
	}
	private pairKeyMatches(pair: SyntaxNode, key: string) {
		const keyNode = pair.childByFieldName('key');
		return keyNode !== undefined && ComposeDocument.decode(this.fragment(keyNode)) === key;
	}
	resolve(path: readonly string[]): SyntaxNode | undefined {
		let node = ComposeDocument.content(this.root);
		for (const key of path) {
			const mapping = node ? ComposeDocument.mapping(node) : undefined;
			const pair = mapping
				? this.pairs(mapping).find((candidate) => this.pairKeyMatches(candidate, key))
				: undefined;
			if (!pair) return undefined;
			node = pair.childByFieldName('value');
		}
		return node;
	}
	editableTarget(path: readonly string[], inspectChildren = true): SyntaxNode {
		let node = ComposeDocument.content(this.root) ?? this.root;
		const hasMergeKey = (mapping: SyntaxNode) =>
			this.pairs(mapping).some((pair) => {
				const keyNode = pair.childByFieldName('key');
				return keyNode !== undefined && this.fragment(keyNode) === '<<';
			});
		for (const key of path) {
			if (this.hasDecoration(node)) throw ComposeDocumentError.unsupported;
			if (ComposeDocument.content(node)?.type === 'flow_mapping' && this.fragment(node) === '{}')
				return node;
			const mapping = ComposeDocument.mapping(node);
			if (!mapping) throw ComposeDocumentError.unsupported;
			if (hasMergeKey(mapping)) throw ComposeDocumentError.unsupported;
			const pair = this.pairs(mapping).find((candidate) => this.pairKeyMatches(candidate, key));
			const value = pair?.childByFieldName('value');
			if (!pair || !value) return node;
			node = value;
		}
		if (this.hasDecoration(node)) throw ComposeDocumentError.unsupported;
		const mapping = ComposeDocument.mapping(node);
		if (mapping && hasMergeKey(mapping)) throw ComposeDocumentError.unsupported;
		if (inspectChildren && this.containsUnsupported(node)) throw ComposeDocumentError.unsupported;
		return node;
	}
	private hasDecoration(node: SyntaxNode): boolean {
		if (['anchor', 'alias', 'tag'].includes(node.type)) return true;
		return (
			['block_node', 'flow_node'].includes(node.type) &&
			ComposeDocument.children(node).some((child) =>
				['anchor', 'alias', 'tag'].includes(child.type)
			)
		);
	}
	private containsUnsupported(node: SyntaxNode): boolean {
		if (this.hasDecoration(node)) return true;
		if (node.type === 'flow_mapping') return this.fragment(node) !== '{}';
		if (node.type === 'flow_sequence') {
			return ComposeDocument.flowItems(node).some(
				(item) => !ComposeDocument.isScalar(item) || this.containsUnsupported(item)
			);
		}
		if (node.type === 'block_mapping_pair') {
			const keyNode = node.childByFieldName('key');
			if (keyNode && this.fragment(keyNode) === '<<') return true;
		}
		return ComposeDocument.children(node).some((child) => this.containsUnsupported(child));
	}
	private validateKeys(node: SyntaxNode) {
		if (['block_mapping', 'flow_mapping'].includes(node.type)) {
			const seen = new Set<string>();
			for (const pair of this.pairs(node)) {
				const keyNode =
					pair.childByFieldName('key') ?? (pair.type === 'flow_node' ? pair : undefined);
				if (!keyNode || !ComposeDocument.isScalar(keyNode)) continue;
				const decoded = ComposeDocument.decode(this.fragment(keyNode));
				if (decoded === undefined) continue;
				if (seen.has(decoded))
					throw ComposeDocumentError.invalid(`Duplicate YAML key: ${decoded}.`);
				seen.add(decoded);
			}
		}
		for (const child of ComposeDocument.children(node)) this.validateKeys(child);
	}

	// MARK: - Editing (ComposeDocument+Editing.swift)

	setting(value: string, path: readonly string[]): string {
		const key = path[path.length - 1];
		if (key === undefined) throw ComposeDocumentError.unsupported;
		this.validateFragment(value);
		const parentPath = path.slice(0, -1);
		if (trimWhitespace(this.source) === '') {
			let nested = value;
			for (const name of [...path].reverse()) nested = this.entry(name, nested, 0);
			return this.replace({ location: 0, length: this.source.length }, nested + this.newline);
		}
		this.editableTarget(parentPath, false);
		const node = this.resolve(path);
		if (node) {
			this.editableTarget(path);
			if (value === this.fragment(node)) return this.source;
			// Avoid changing spelling, comments, or quoting on an unchanged form value.
			if (
				ComposeDocument.isScalar(node) &&
				(ComposeDocument.decode(value) ?? null) ===
					(ComposeDocument.decode(this.fragment(node)) ?? null)
			) {
				return this.source;
			}
			const replacementDocument = ComposeDocument.parse(value);
			const isBlock =
				ComposeDocument.mapping(replacementDocument.root) !== undefined ||
				ComposeDocument.sequence(replacementDocument.root) !== undefined;
			if (
				isBlock &&
				ComposeDocument.mapping(node) === undefined &&
				ComposeDocument.sequence(node) === undefined
			) {
				const pairColumn = node.parent ? this.column(node.parent) : 0;
				return this.replace(
					this.range(node),
					this.newline + spaces(pairColumn + 2) + this.reindent(value, pairColumn + 2)
				);
			}
			return this.replace(this.range(node), this.reindent(value, this.column(node)));
		}
		const parent = this.resolve(parentPath);
		const mapping = parent ? ComposeDocument.mapping(parent) : undefined;
		if (!mapping) {
			// Create missing ancestor mappings, using the same source-range insertion path.
			if (parentPath.length > 0 && parent === undefined)
				return this.setting(this.entry(key, value, 0), parentPath);
			if (parent && this.fragment(parent) === '{}') {
				const pair = parent.parent ?? parent;
				return this.expandingEmptyMapping(pair, this.range(parent), key, value);
			}
			if (parentPath.length === 0 && trimWhitespace(this.source) === '') {
				return this.replace(
					{ location: 0, length: this.source.length },
					this.entry(key, value, 0) + this.newline
				);
			}
			throw ComposeDocumentError.unsupported;
		}
		const entries = this.pairs(mapping);
		const emptyPair = entries.find((pair) => this.pairKeyMatches(pair, key));
		if (emptyPair) return this.expandingEmptyMapping(emptyPair, undefined, key, value, false);
		const last = entries[entries.length - 1];
		if (!last) throw ComposeDocumentError.unsupported;
		const insertion = this.lineEnd(maxRange(this.range(last)));
		const prefix = insertion > 0 && this.source[insertion - 1] !== '\n' ? this.newline : '';
		return this.replace(
			{ location: insertion, length: 0 },
			prefix + this.entry(key, value, this.column(last)) + this.newline
		);
	}

	removing(path: readonly string[]): string {
		const key = path[path.length - 1];
		const parent = key === undefined ? undefined : this.resolve(path.slice(0, -1));
		const mapping = parent ? ComposeDocument.mapping(parent) : undefined;
		if (key === undefined || !mapping) throw ComposeDocumentError.missing;
		this.editableTarget(path);
		const pair = this.pairs(mapping).find((candidate) => this.pairKeyMatches(candidate, key));
		if (!pair) throw ComposeDocumentError.missing;
		if (this.pairs(mapping).length === 1) {
			// An empty mapping stays a mapping rather than changing to YAML null.
			return this.replace(this.range(mapping), '{}');
		}
		return this.replace(this.fullLines(pair), '');
	}

	settingItem(rawValue: string, path: readonly string[], index: number): string {
		const node = this.resolve(path);
		const flow = node ? ComposeDocument.flowSequence(node) : undefined;
		if (flow) {
			this.editableTarget(path);
			const items = ComposeDocument.flowItems(flow);
			const item = items[index];
			if (!item) throw ComposeDocumentError.missing;
			this.validateFlowItem(rawValue);
			return this.replace(this.range(item), rawValue);
		}
		const item = this.sequenceItem(path, index);
		const content = ComposeDocument.content(item);
		if (!content) throw ComposeDocumentError.unsupported;
		this.validateFragment(rawValue);
		return this.replace(this.range(content), this.reindent(rawValue, this.column(content)));
	}

	removingItem(path: readonly string[], index: number): string {
		const node = this.resolve(path);
		const flow = node ? ComposeDocument.flowSequence(node) : undefined;
		if (flow) {
			this.editableTarget(path);
			const items = ComposeDocument.flowItems(flow);
			const item = items[index];
			if (!item) throw ComposeDocumentError.missing;
			const commas = this.flowCommas(flow);
			// Delete syntax tokens only, retaining surrounding whitespace and comments.
			const itemRange = this.range(item);
			const comma =
				commas.find((candidate) => this.range(candidate).location >= maxRange(itemRange)) ??
				commas.findLast((candidate) => maxRange(this.range(candidate)) <= itemRange.location);
			const ranges = [itemRange];
			if (comma) ranges.push(this.range(comma));
			if (items.length === 1) {
				ranges.push(
					...commas
						.filter((candidate) => candidate !== comma)
						.map((candidate) => this.range(candidate))
				);
			}
			let result = this.source;
			for (const bounds of ranges.sort((a, b) => b.location - a.location)) {
				result = result.slice(0, bounds.location) + result.slice(maxRange(bounds));
			}
			ComposeDocument.parse(result);
			return result;
		}
		const item = this.sequenceItem(path, index);
		if (this.items(path)?.length === 1 && node) return this.replace(this.range(node), '[]');
		return this.replace(this.fullLines(item), '');
	}

	appendingItem(rawValue: string, path: readonly string[]): string {
		this.validateFragment(rawValue);
		const node = this.resolve(path);
		if (!node) return this.setting('- ' + rawValue, path);
		const flow = ComposeDocument.flowSequence(node);
		if (flow) {
			this.editableTarget(path);
			this.validateFlowItem(rawValue);
			const items = ComposeDocument.flowItems(flow);
			const close = maxRange(this.range(flow)) - 1;
			let result =
				this.source.slice(0, close) +
				(items.length === 0 ? '' : ' ') +
				rawValue +
				this.source.slice(close);
			const last = items[items.length - 1];
			if (
				last &&
				!this.flowCommas(flow).some(
					(comma) => this.range(comma).location >= maxRange(this.range(last))
				)
			) {
				const at = maxRange(this.range(last));
				result = result.slice(0, at) + ',' + result.slice(at);
			}
			ComposeDocument.parse(result);
			return result;
		}
		this.editableTarget(path);
		const sequence = ComposeDocument.sequence(node);
		const last = sequence
			? ComposeDocument.children(sequence).findLast((child) => child.type === 'block_sequence_item')
			: undefined;
		if (!sequence || !last) throw ComposeDocumentError.unsupported;
		const insertion = this.lineEnd(maxRange(this.range(last)));
		const indent = this.column(last);
		const prefix = insertion > 0 && this.source[insertion - 1] !== '\n' ? this.newline : '';
		return this.replace(
			{ location: insertion, length: 0 },
			prefix + spaces(indent) + '- ' + this.reindent(rawValue, indent + 2) + this.newline
		);
	}

	private expandingEmptyMapping(
		pair: SyntaxNode,
		bounds: Range | undefined,
		key: string,
		value: string,
		nested = true
	): string {
		const insertion = this.lineEnd(maxRange(this.range(pair)));
		const prefix = insertion > 0 && this.source[insertion - 1] !== '\n' ? this.newline : '';
		const text = nested
			? this.entry(key, value, this.column(pair) + 2)
			: // The requested key is the existing null entry; add its value below its original line.
				spaces(this.column(pair) + 2) + this.reindent(value, this.column(pair) + 2);
		let result =
			this.source.slice(0, insertion) + prefix + text + this.newline + this.source.slice(insertion);
		if (bounds) result = result.slice(0, bounds.location) + result.slice(maxRange(bounds));
		ComposeDocument.parse(result);
		return result;
	}

	private validateFlowItem(value: string) {
		const document = ComposeDocument.parse('[' + value + ']');
		const sequence = ComposeDocument.flowSequence(document.root);
		const items = sequence ? ComposeDocument.flowItems(sequence) : [];
		const item = items[0];
		if (
			!sequence ||
			items.length !== 1 ||
			!item ||
			!ComposeDocument.isScalar(item) ||
			!document.isEditable([]) ||
			document.fragment(item) !== value ||
			value.includes('\n') ||
			value.includes('\r')
		) {
			throw ComposeDocumentError.unsupported;
		}
	}

	private sequenceItem(path: readonly string[], index: number): SyntaxNode {
		this.editableTarget(path);
		const node = this.resolve(path);
		const sequence = node ? ComposeDocument.sequence(node) : undefined;
		if (!sequence) throw ComposeDocumentError.unsupported;
		const items = ComposeDocument.children(sequence).filter(
			(child) => child.type === 'block_sequence_item'
		);
		const item = items[index];
		if (!item) throw ComposeDocumentError.missing;
		return item;
	}

	private entry(key: string, value: string, indent: number): string {
		const padding = spaces(indent);
		const document = ComposeDocument.tryParse(value);
		const block = document
			? ComposeDocument.mapping(document.root) !== undefined ||
				ComposeDocument.sequence(document.root) !== undefined
			: false;
		if (block || value.includes('\n') || value.startsWith('- ')) {
			return (
				padding +
				ComposeDocument.quoted(key) +
				':' +
				this.newline +
				spaces(indent + 2) +
				this.reindent(value, indent + 2)
			);
		}
		return padding + ComposeDocument.quoted(key) + ': ' + value;
	}

	private validateFragment(value: string) {
		const document = ComposeDocument.parse(value);
		if (ComposeDocument.content(document.root) === undefined)
			throw ComposeDocumentError.invalid('Enter a YAML value.');
	}

	private replace(range: Range, replacement: string): string {
		const result =
			this.source.slice(0, range.location) + replacement + this.source.slice(maxRange(range));
		ComposeDocument.parse(result);
		return result;
	}

	private reindent(value: string, column: number): string {
		return value
			.replace(/\r\n/g, '\n')
			.split('\n')
			.map((line, index) => (index === 0 || line === '' ? line : spaces(column) + line))
			.join(this.newline);
	}

	private fullLines(node: SyntaxNode): Range {
		const bounds = this.range(node);
		const start = this.lineStart(bounds.location);
		return { location: start, length: this.lineEnd(maxRange(bounds)) - start };
	}

	// MARK: - Block scalars (ComposeDocument+BlockScalars.swift)

	/** YAML 1.2 block scalar indentation, folding and chomping; never resolves interpolation. */
	blockScalar(node: SyntaxNode): ComposeBlockScalar {
		if (node.type !== 'block_scalar') throw ComposeDocumentError.unsupported;
		const bounds = this.range(node);
		const text = this.source;
		const raw = this.substring(bounds).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		const newlineIndex = raw.indexOf('\n');
		const header = newlineIndex === -1 ? raw : raw.slice(0, newlineIndex);
		const indicatorMatch = /^[^\s#]*/.exec(header);
		const indicator = indicatorMatch ? indicatorMatch[0] : '';
		const style = indicator[0];
		if (style !== '|' && style !== '>') throw ComposeDocumentError.unsupported;
		const digit = /[0-9]/.exec(indicator);
		const explicitIndent = digit ? Number(digit[0]) : null;
		const headerSuffix = header.slice(indicator.length);
		let parent = node.parent;
		while (parent && !['block_mapping_pair', 'block_sequence_item'].includes(parent.type))
			parent = parent.parent;
		const parentIndent = parent ? this.column(parent) : 0;
		let extentEnd = maxRange(bounds);
		// Tree-sitter excludes the final newline and chomped empty lines from clipped/stripped nodes.
		if (extentEnd < text.length && text.charCodeAt(extentEnd) === 13) extentEnd += 1;
		if (extentEnd < text.length && text.charCodeAt(extentEnd) === 10) extentEnd += 1;
		while (extentEnd < text.length) {
			let end = extentEnd;
			while (end < text.length && text.charCodeAt(end) !== 10) end += 1;
			if (end < text.length) end += 1;
			if (end <= extentEnd) break;
			const nextLine = text.slice(extentEnd, end);
			if (trimWhitespace(nextLine) !== '') break;
			extentEnd = end;
		}
		const lexical = text
			.slice(bounds.location, extentEnd)
			.replace(/\r\n/g, '\n')
			.replace(/\r/g, '\n');
		const bodyIndex = lexical.indexOf('\n');
		const body = bodyIndex === -1 ? '' : lexical.slice(bodyIndex + 1);
		const lines = body.split('\n');
		const firstContent = lines.find((line) => /[^ ]/.test(line));
		const detected = firstContent === undefined ? undefined : leadingSpaces(firstContent);
		const emptyIndentation = Math.max(parentIndent + 1, Math.max(0, ...lines.map(leadingSpaces)));
		const indentation =
			explicitIndent !== null ? parentIndent + explicitIndent : (detected ?? emptyIndentation);
		const content = lines.map((line) => line.slice(Math.min(leadingSpaces(line), indentation)));
		let value = '';
		for (let i = 0; i < content.length; i++) {
			const line = content[i]!;
			value += line;
			if (i + 1 >= content.length) continue;
			if (style === '|') {
				value += '\n';
				continue;
			}
			const next = content[i + 1]!;
			const ordinary = line !== '' && line[0] !== ' ' && line[0] !== '\t';
			const following = content.slice(i + 1).find((candidate) => candidate !== '');
			if (ordinary && next !== '' && next[0] !== ' ' && next[0] !== '\t') {
				value += ' ';
			} else if (
				ordinary &&
				next === '' &&
				following !== undefined &&
				following[0] !== ' ' &&
				following[0] !== '\t'
			) {
				// The first break of a paragraph separator is folded away; the empty lines remain.
			} else {
				value += '\n';
			}
		}
		if (!indicator.includes('+')) {
			const hadFinalBreak = value.endsWith('\n');
			value = value.replace(/\n+$/, '');
			if (!indicator.includes('-') && value !== '' && hadFinalBreak) value += '\n';
		}
		return {
			value,
			replacementRange: { location: bounds.location, length: extentEnd - bounds.location },
			indentation,
			parentIndentation: parentIndent,
			explicitIndentation: explicitIndent,
			headerSuffix
		};
	}

	replacingBlockScalar(block: ComposeBlockScalar, value: string): string {
		let replacement: string;
		// eslint-disable-next-line no-control-regex
		if (/[\u0000-\u0008\u000b-\u001f]/.test(value)) {
			replacement = ComposeDocument.quoted(value) + block.headerSuffix + this.newline;
		} else {
			const trailingBreaks = value.length - value.replace(/\n+$/, '').length;
			const onlyBreaks = /^\n*$/.test(value);
			const chomp = trailingBreaks === 0 ? '-' : trailingBreaks > 1 || onlyBreaks ? '+' : '';
			let indentation = block.indentation;
			let indicator = block.explicitIndentation === null ? '' : String(block.explicitIndentation);
			const firstLine = value.split('\n').find((line) => line !== '');
			const needsExplicitIndent =
				firstLine !== undefined && (firstLine[0] === ' ' || firstLine[0] === '\t');
			if (needsExplicitIndent && indicator === '') {
				const relative = indentation - block.parentIndentation;
				if (relative >= 1 && relative <= 9) {
					indicator = String(relative);
				} else {
					indicator = '2';
					indentation = block.parentIndentation + 2;
				}
			}
			let lines = value.split('\n');
			if (value.endsWith('\n')) lines.pop();
			if (value === '') lines = [];
			const padding = spaces(indentation);
			const body = lines.map((line) => (line === '' ? '' : padding + line)).join(this.newline);
			// Literal style expresses the exact edited value without introducing new folding.
			replacement =
				'|' +
				indicator +
				chomp +
				block.headerSuffix +
				this.newline +
				(lines.length === 0 ? '' : body + this.newline);
		}
		const range = block.replacementRange;
		const result =
			this.source.slice(0, range.location) + replacement + this.source.slice(maxRange(range));
		ComposeDocument.parse(result);
		return result;
	}

	// MARK: - Native fields (ComposeDocument+Native.swift)

	nativeField(path: ComposeFieldPath, name = 'Value'): ComposeNativeField {
		const fieldPath = [...path];
		try {
			const node = this.nativeNode(path);
			if (!node) return { name, path: fieldPath, kind: 'null', value: '' };
			const content = ComposeDocument.content(node);
			if (this.nativeUnsafe(node) || !content) throw ComposeDocumentError.unsupported;
			let kind: ComposeNativeKind;
			let value: string;
			switch (content.type) {
				case 'block_mapping':
				case 'flow_mapping':
					kind = 'mapping';
					value = '';
					break;
				case 'block_sequence':
				case 'flow_sequence':
					kind = 'sequence';
					value = '';
					break;
				case 'plain_scalar':
					switch (ComposeDocument.children(content)[0]?.type) {
						case 'boolean_scalar':
							kind = 'boolean';
							break;
						case 'integer_scalar':
						case 'float_scalar':
							kind = 'number';
							break;
						case 'null_scalar':
							kind = 'null';
							break;
						default:
							kind = 'string';
					}
					value = this.fragment(content);
					break;
				case 'block_scalar':
					kind = 'string';
					value = this.blockScalar(content).value;
					break;
				case 'double_quote_scalar':
				case 'single_quote_scalar': {
					const decoded = ComposeDocument.decode(this.fragment(content));
					if (decoded === undefined || this.fragment(content).includes('\n'))
						throw ComposeDocumentError.unsupported;
					kind = 'string';
					value = decoded;
					break;
				}
				default:
					throw ComposeDocumentError.unsupported;
			}
			if (content.type === 'plain_scalar' && value.includes('\n'))
				throw ComposeDocumentError.unsupported;
			return { name, path: fieldPath, kind, value };
		} catch {
			return { name, path: fieldPath, kind: 'unsupported', value: '' };
		}
	}

	nativeFields(path: ComposeFieldPath): ComposeNativeField[] {
		let node: SyntaxNode | undefined;
		try {
			node = this.nativeNode(path);
		} catch {
			return [];
		}
		if (!node || this.nativeUnsafe(node)) return [];
		const content = ComposeDocument.content(node);
		if (!content) return [];
		if (this.nativeMapping(content)) {
			return this.nativePairs(content).flatMap((pair) => {
				const name = this.nativeKey(pair);
				return name === undefined ? [] : [this.nativeField([...path, { key: name }], name)];
			});
		}
		if (this.nativeSequence(content)) {
			return this.nativeItems(content).map((_, i) =>
				this.nativeField([...path, { index: i }], `Item ${i + 1}`)
			);
		}
		return [];
	}

	static nativeLiteral(kind: ComposeNativeKind, value: string): string {
		switch (kind) {
			case 'string':
				return ComposeDocument.quoted(value);
			case 'boolean':
				return value.toLowerCase() === 'true' ? 'true' : 'false';
			case 'null':
				return 'null';
			case 'mapping':
				return '{}';
			case 'sequence':
				return '[]';
			case 'number': {
				const parsed = ComposeDocument.parse(value);
				if (
					parsed.nativeField([]).kind !== 'number' ||
					parsed.rawValue([]) !== value ||
					value.includes('\n') ||
					value.includes('\r') ||
					value !== value.replace(/^[ \t]+|[ \t]+$/g, '')
				) {
					throw ComposeFormError.invalid('Enter a valid number.');
				}
				return value;
			}
			case 'unsupported':
				throw ComposeDocumentError.unsupported;
		}
	}

	settingNative(value: string, kind: ComposeNativeKind, path: ComposeFieldPath): string {
		const literal = ComposeDocument.nativeLiteral(kind, value);
		const node = this.nativeNode(path);
		if (kind === 'null' && !node && this.nativeEntryExists(path)) return this.source;
		if (node) {
			const content = ComposeDocument.content(node);
			if (this.nativeUnsafe(node) || !content || this.nativeContainsReferences(content))
				throw ComposeDocumentError.unsupported;
			const current = this.nativeField(path);
			if (current.kind === kind && (current.value === value || kind === 'null')) return this.source;
			if (
				this.nativeHasAnchor(node) &&
				(current.kind !== kind || kind === 'mapping' || kind === 'sequence')
			) {
				throw ComposeDocumentError.unsupported;
			}
			if (content.type === 'block_scalar' && kind === 'string') {
				const result = this.replacingBlockScalar(this.blockScalar(content), value);
				if (ComposeDocument.parse(result).nativeField(path).value !== value)
					throw ComposeDocumentError.unsupported;
				return result;
			}
			if (content.type === 'block_scalar') {
				const block = this.blockScalar(content);
				return this.nativeApplying([
					[block.replacementRange, literal + block.headerSuffix + this.newline]
				]);
			}
			return this.nativeApplying([[this.range(content), literal]]);
		}
		const last = path[path.length - 1];
		if (last === undefined) {
			const prefix = this.source === '' || this.source.endsWith('\n') ? '' : this.newline;
			return this.nativeApplying([
				[{ location: this.source.length, length: 0 }, prefix + literal + this.newline]
			]);
		}
		const parentPath = path.slice(0, -1);
		const parent = this.nativeNode(parentPath);
		const content = parent ? ComposeDocument.content(parent) : undefined;
		if (!parent || !content || this.nativeUnsafe(parent)) {
			// Native callers can create a missing object a field at a time.
			if (isKey(last)) {
				const parentSource = this.settingNative('', 'mapping', parentPath);
				return ComposeDocument.parse(parentSource).settingNative(value, kind, [
					...parentPath,
					{ key: last.key }
				]);
			}
			throw ComposeDocumentError.unsupported;
		}
		if (isKey(last) && this.nativeField(parentPath).kind === 'null') {
			const expanded = this.settingNative('', 'mapping', parentPath);
			return ComposeDocument.parse(expanded).settingNative(value, kind, path);
		}
		if (isKey(last) && this.nativeMapping(content)) {
			const pair = this.nativePairs(content).find(
				(candidate) => this.nativeKey(candidate) === last.key
			);
			if (pair) {
				if (pair.type === 'flow_node') {
					return this.nativeApplying([
						[{ location: maxRange(this.range(pair)), length: 0 }, ': ' + literal]
					]);
				}
				const colon = pair.allChildren.find((child) => child.type === ':');
				if (!colon) throw ComposeDocumentError.unsupported;
				return this.nativeApplying([
					[{ location: maxRange(this.range(colon)), length: 0 }, ' ' + literal]
				]);
			}
			return this.nativeAppend(last.key, literal, content);
		}
		if (!isKey(last) && this.nativeSequence(content)) {
			const item = this.nativeItems(content)[last.index];
			if (!item) throw ComposeDocumentError.missing;
			return this.nativeApplying([
				[{ location: maxRange(this.range(item)), length: 0 }, ' ' + literal]
			]);
		}
		throw ComposeDocumentError.unsupported;
	}

	addingService(name: string, field: string, value: string, kind: ComposeNativeKind): string {
		if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
			throw ComposeFormError.invalid(
				'Use letters, numbers, dots, underscores or hyphens for the service name.'
			);
		}
		if (field === '') throw ComposeFormError.invalid('Enter a field name.');
		const added = this.addingNative('', 'mapping', name, [{ key: 'services' }]);
		return ComposeDocument.parse(added).addingNative(value, kind, field, [
			{ key: 'services' },
			{ key: name }
		]);
	}

	addingNative(
		value: string,
		kind: ComposeNativeKind,
		key: string | undefined,
		path: ComposeFieldPath
	): string {
		const literal = ComposeDocument.nativeLiteral(kind, value);
		const node = this.nativeNode(path);
		const content = node ? ComposeDocument.content(node) : undefined;
		if (!node || !content) {
			if (key === undefined) throw ComposeDocumentError.unsupported;
			return this.settingNative(value, kind, [...path, { key }]);
		}
		if (this.nativeUnsafe(node)) throw ComposeDocumentError.unsupported;
		if (this.nativeField(path).kind === 'null' && key !== undefined) {
			const expanded = this.settingNative('', 'mapping', path);
			return ComposeDocument.parse(expanded).addingNative(value, kind, key, path);
		}
		if (this.nativeMapping(content)) {
			if (key === undefined || key === '') throw ComposeFormError.invalid('Enter a field name.');
			if (key === '<<') throw ComposeDocumentError.unsupported;
			if (this.nativePairs(content).some((pair) => this.nativeKey(pair) === key))
				throw ComposeFormError.duplicate;
			return this.nativeAppend(key, literal, content);
		}
		if (this.nativeSequence(content)) return this.nativeAppend(undefined, literal, content);
		throw ComposeDocumentError.unsupported;
	}

	removingNative(path: ComposeFieldPath): string {
		const last = path[path.length - 1];
		const parent = last === undefined ? undefined : this.nativeNode(path.slice(0, -1));
		const container = parent ? ComposeDocument.content(parent) : undefined;
		if (last === undefined || !parent || !container || this.nativeUnsafe(parent))
			throw ComposeDocumentError.unsupported;
		let entries: SyntaxNode[];
		let target: SyntaxNode;
		if (isKey(last)) {
			if (last.key === '<<') throw ComposeDocumentError.unsupported;
			entries = this.nativePairs(container);
			const pair = entries.find((candidate) => this.nativeKey(candidate) === last.key);
			if (!pair) throw ComposeDocumentError.missing;
			target = pair;
		} else {
			entries = this.nativeItems(container);
			const item = entries[last.index];
			if (!item) throw ComposeDocumentError.missing;
			target = item;
		}
		// Refuse deleting anchors or aliases; their references can exist outside this subtree.
		if (this.nativeContainsReferences(target)) throw ComposeDocumentError.unsupported;
		if (container.type.startsWith('flow_')) {
			const edits: Edit[] = [[this.range(target), '']];
			const commas = this.flowCommas(container);
			const comma =
				commas.find(
					(candidate) => this.range(candidate).location >= maxRange(this.range(target))
				) ??
				commas.findLast(
					(candidate) => maxRange(this.range(candidate)) <= this.range(target).location
				);
			if (comma) edits.push([this.range(comma), '']);
			return this.nativeApplying(edits);
		}
		if (entries.length === 1) {
			// Keep comments from the removed subtree as comments adjacent to the empty container.
			const replacement = this.nativeMapping(container) ? '{}' : '[]';
			const comments = this.nativeComments(target).map((comment) =>
				this.substring(this.range(comment))
			);
			const suffix =
				comments.length === 0
					? ''
					: ' ' + comments.join(this.newline + spaces(this.column(container)));
			return this.nativeApplying([[this.range(container), replacement + suffix]]);
		}
		const bounds = this.range(target);
		const start = this.lineStart(bounds.location);
		const end = this.lineEnd(maxRange(bounds));
		const comments = this.nativeComments(target)
			.map(
				(comment) =>
					spaces(this.column(target)) + this.substring(this.range(comment)) + this.newline
			)
			.join('');
		const prefix = this.substring({ location: start, length: bounds.location - start });
		if (prefix.replace(/^[ \t]+|[ \t]+$/g, '') !== '') {
			// A compact mapping/list can share its first line with an outer sequence dash.
			// Retain that dash and leave the remaining children on their indented lines.
			const trailing = this.substring({
				location: maxRange(bounds),
				length: end - maxRange(bounds)
			});
			const hash = trailing.indexOf('#');
			const comment = hash === -1 ? '' : trailing.slice(hash).replace(/^[\r\n]+|[\r\n]+$/g, '');
			return this.nativeApplying([
				[
					{ location: bounds.location, length: end - bounds.location },
					comment + this.newline + comments
				]
			]);
		}
		return this.nativeApplying([[{ location: start, length: end - start }, comments]]);
	}

	private nativeAppend(key: string | undefined, literal: string, container: SyntaxNode): string {
		const entries = this.nativeMapping(container)
			? this.nativePairs(container)
			: this.nativeItems(container);
		const text = key !== undefined ? ComposeDocument.quoted(key) + ': ' + literal : literal;
		if (container.type.startsWith('flow_')) {
			const close = maxRange(this.range(container)) - 1;
			const edits: Edit[] = [
				[{ location: close, length: 0 }, (entries.length === 0 ? '' : ' ') + text]
			];
			const last = entries[entries.length - 1];
			if (
				last &&
				!this.flowCommas(container).some(
					(comma) => this.range(comma).location >= maxRange(this.range(last))
				)
			) {
				edits.push([{ location: maxRange(this.range(last)), length: 0 }, ',']);
			}
			return this.nativeApplying(edits);
		}
		const last = entries[entries.length - 1];
		if (!last) throw ComposeDocumentError.unsupported;
		const insertion = this.lineEnd(maxRange(this.range(last)));
		const prefix = insertion > 0 && this.source[insertion - 1] === '\n' ? '' : this.newline;
		const row = spaces(this.column(last)) + (key === undefined ? '- ' : '') + text + this.newline;
		return this.nativeApplying([[{ location: insertion, length: 0 }, prefix + row]]);
	}

	private nativeNode(path: ComposeFieldPath): SyntaxNode | undefined {
		let node = ComposeDocument.content(this.root);
		for (const component of path) {
			const current = node;
			if (!current) return undefined;
			const content = ComposeDocument.content(current);
			if (this.nativeUnsafe(current) || !content) throw ComposeDocumentError.unsupported;
			if (isKey(component)) {
				if (component.key === '<<') throw ComposeDocumentError.unsupported;
				if (
					content.type === 'plain_scalar' &&
					ComposeDocument.children(content)[0]?.type === 'null_scalar'
				)
					return undefined;
				if (!this.nativeMapping(content)) throw ComposeDocumentError.unsupported;
				node = this.nativePairs(content)
					.find((pair) => this.nativeKey(pair) === component.key)
					?.childByFieldName('value');
			} else {
				if (!this.nativeSequence(content)) throw ComposeDocumentError.unsupported;
				const items = this.nativeItems(content);
				const item = items[component.index];
				if (!item) throw ComposeDocumentError.missing;
				node = content.type === 'flow_sequence' ? item : ComposeDocument.content(item);
			}
		}
		return node;
	}

	private nativeEntryExists(path: ComposeFieldPath): boolean {
		const last = path[path.length - 1];
		if (last === undefined) return false;
		let parent: SyntaxNode | undefined;
		try {
			parent = this.nativeNode(path.slice(0, -1));
		} catch {
			return false;
		}
		const content = parent ? ComposeDocument.content(parent) : undefined;
		if (!content) return false;
		if (isKey(last))
			return this.nativePairs(content).some((pair) => this.nativeKey(pair) === last.key);
		return last.index >= 0 && last.index < this.nativeItems(content).length;
	}

	private nativeMapping(node: SyntaxNode) {
		return typeIs(node, 'block_mapping', 'flow_mapping');
	}
	private nativeSequence(node: SyntaxNode) {
		return typeIs(node, 'block_sequence', 'flow_sequence');
	}
	private nativePairs(node: SyntaxNode): SyntaxNode[] {
		return ComposeDocument.children(node).filter(
			(child) =>
				['block_mapping_pair', 'flow_pair'].includes(child.type) ||
				(node.type === 'flow_mapping' && child.type === 'flow_node')
		);
	}
	private nativeItems(node: SyntaxNode): SyntaxNode[] {
		return ComposeDocument.children(node).filter((child) => child.type !== 'comment');
	}
	private nativeKey(pair: SyntaxNode): string | undefined {
		const keyNode = pair.childByFieldName('key') ?? (pair.type === 'flow_node' ? pair : undefined);
		return keyNode ? ComposeDocument.decode(this.fragment(keyNode)) : undefined;
	}

	private nativeUnsafe(node: SyntaxNode): boolean {
		if (node.type === 'alias' || this.nativeUnsupportedTag(node)) return true;
		if (
			typeIs(node, 'block_node', 'flow_node') &&
			ComposeDocument.children(node).some(
				(child) => child.type === 'alias' || this.nativeUnsupportedTag(child)
			)
		) {
			return true;
		}
		const parent = node.parent;
		if (
			parent &&
			typeIs(parent, 'block_node', 'flow_node') &&
			ComposeDocument.children(parent).some((child) => this.nativeUnsupportedTag(child))
		) {
			return true;
		}
		const content = ComposeDocument.content(node);
		if (!content) return false;
		if (this.nativeMapping(content)) {
			const entries = this.nativePairs(content);
			if (
				ComposeDocument.children(content).some(
					(child) =>
						!['comment', 'block_mapping_pair', 'flow_pair', 'flow_node'].includes(child.type)
				)
			) {
				return true;
			}
			return entries.some((pair) => {
				const keyNode =
					pair.childByFieldName('key') ?? (pair.type === 'flow_node' ? pair : undefined);
				if (!keyNode || !ComposeDocument.isScalar(keyNode) || this.nativeKey(pair) === undefined)
					return true;
				return (
					this.fragment(keyNode).includes('\n') ||
					ComposeDocument.children(keyNode).some((child) =>
						['anchor', 'alias', 'tag'].includes(child.type)
					)
				);
			});
		}
		return false;
	}

	private nativeUnsupportedTag(node: SyntaxNode) {
		return node.type === 'tag' && !['!reset', '!override'].includes(this.fragment(node));
	}

	private nativeHasAnchor(node: SyntaxNode): boolean {
		if (ComposeDocument.children(node).some((child) => child.type === 'anchor')) return true;
		const parent = node.parent;
		if (parent && typeIs(parent, 'block_node', 'flow_node')) {
			return ComposeDocument.children(parent).some((child) => child.type === 'anchor');
		}
		return false;
	}

	private nativeContainsReferences(node: SyntaxNode): boolean {
		return (
			['anchor', 'alias', 'tag'].includes(node.type) ||
			ComposeDocument.children(node).some((child) => this.nativeContainsReferences(child))
		);
	}
	private nativeComments(node: SyntaxNode): SyntaxNode[] {
		if (node.type === 'comment') return [node];
		return ComposeDocument.children(node).flatMap((child) => this.nativeComments(child));
	}
	private nativeApplying(edits: Edit[]): string {
		let result = this.source;
		for (const [bounds, replacement] of [...edits].sort((a, b) => b[0].location - a[0].location)) {
			result = result.slice(0, bounds.location) + replacement + result.slice(maxRange(bounds));
		}
		ComposeDocument.parse(result);
		return result;
	}

	// MARK: - Networks (ComposeDocument+Networks.swift)

	/** Converts only attachment syntax, keeping each name, comment and surrounding source in place. */
	convertingNetworkAttachments(path: readonly string[]): string {
		const node = this.resolve(path);
		if (!node) return this.source;
		if (typeIs(ComposeDocument.content(node), 'block_mapping', 'flow_mapping')) return this.source;
		this.editableTarget(path);
		const flow = ComposeDocument.flowSequence(node);
		if (flow) {
			let pair: SyntaxNode | null = node;
			while (pair && pair.type !== 'block_mapping_pair') {
				if (pair.type === 'flow_pair') throw ComposeDocumentError.unsupported;
				pair = pair.parent;
			}
			if (!pair) throw ComposeDocumentError.unsupported;
			const items = ComposeDocument.flowItems(flow);
			const names = new Set<string>();
			const indent = spaces(this.column(pair) + 2);
			const comments = ComposeDocument.children(flow).filter((child) => child.type === 'comment');
			const rows: string[] = [];
			const firstItem = items[0];
			for (const comment of comments) {
				if (!firstItem || this.range(comment).location < this.range(firstItem).location)
					rows.push(indent + this.substring(this.range(comment)));
			}
			items.forEach((item, i) => {
				const name = ComposeDocument.isScalar(item)
					? ComposeDocument.decode(this.fragment(item))
					: undefined;
				if (name === undefined || name === '' || names.has(name))
					throw ComposeDocumentError.unsupported;
				names.add(name);
				let row = indent + ComposeDocument.quoted(name) + ': {}';
				const nextItem = items[i + 1];
				const next = nextItem ? this.range(nextItem).location : maxRange(this.range(flow));
				const attached = comments.filter(
					(comment) =>
						this.range(comment).location >= maxRange(this.range(item)) &&
						this.range(comment).location < next
				);
				const first = attached[0];
				if (first) row += ' ' + this.substring(this.range(first));
				rows.push(row);
				rows.push(
					...attached.slice(1).map((comment) => indent + this.substring(this.range(comment)))
				);
			});
			if (items.length === 0) {
				const result = this.source.slice(0, flow.start) + '{}' + this.source.slice(flow.end);
				ComposeDocument.parse(result);
				return result;
			}
			// Keep the attachment key's trailing comment on its original line.
			const insertion = this.lineEnd(maxRange(this.range(pair)));
			const prefix = insertion > 0 && this.source[insertion - 1] === '\n' ? '' : this.newline;
			let result =
				this.source.slice(0, insertion) +
				prefix +
				rows.join(this.newline) +
				this.newline +
				this.source.slice(insertion);
			result = result.slice(0, flow.start) + result.slice(flow.end);
			ComposeDocument.parse(result);
			return result;
		}
		const sequence = ComposeDocument.sequence(node);
		if (!sequence) throw ComposeDocumentError.unsupported;
		const edits: Edit[] = [];
		const entries = ComposeDocument.children(sequence).filter(
			(child) => child.type === 'block_sequence_item'
		);
		const names = new Set<string>();
		for (const item of entries) {
			const content = ComposeDocument.content(item);
			const name =
				content && ComposeDocument.isScalar(content)
					? ComposeDocument.decode(this.fragment(content))
					: undefined;
			if (!content || name === undefined || name === '' || names.has(name))
				throw ComposeDocumentError.unsupported;
			names.add(name);
			const bounds = this.range(item);
			const contentBounds = this.range(content);
			edits.push([
				{ location: bounds.location, length: maxRange(contentBounds) - bounds.location },
				ComposeDocument.quoted(name) + ': {}'
			]);
		}
		let result = this.source;
		for (const [bounds, replacement] of edits.sort((a, b) => b[0].location - a[0].location)) {
			result = result.slice(0, bounds.location) + replacement + result.slice(maxRange(bounds));
		}
		ComposeDocument.parse(result);
		return result;
	}
}
