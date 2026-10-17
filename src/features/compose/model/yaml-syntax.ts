import { parseAllDocuments, Parser, type CST } from 'yaml';

export type SyntaxNodeType =
	| 'stream'
	| 'document'
	| 'block_node'
	| 'flow_node'
	| 'block_mapping'
	| 'block_mapping_pair'
	| 'block_sequence'
	| 'block_sequence_item'
	| 'flow_mapping'
	| 'flow_sequence'
	| 'flow_pair'
	| 'plain_scalar'
	| 'string_scalar'
	| 'boolean_scalar'
	| 'integer_scalar'
	| 'float_scalar'
	| 'null_scalar'
	| 'double_quote_scalar'
	| 'single_quote_scalar'
	| 'block_scalar'
	| 'alias'
	| 'anchor'
	| 'tag'
	| 'comment'
	| ':'
	| ','
	| '-'
	| '['
	| ']'
	| '{'
	| '}';

const anonymousTypes = new Set<string>([':', ',', '-', '[', ']', '{', '}']);
const commentContainers = new Set<string>([
	'stream',
	'document',
	'block_node',
	'flow_node',
	'block_mapping',
	'block_mapping_pair',
	'block_sequence',
	'block_sequence_item',
	'flow_mapping',
	'flow_sequence',
	'flow_pair'
]);

export class SyntaxNode {
	readonly type: SyntaxNodeType;
	start: number;
	end: number;
	parent: SyntaxNode | null = null;
	readonly allChildren: SyntaxNode[] = [];
	private readonly fields = new Map<string, SyntaxNode>();

	constructor(type: SyntaxNodeType, start: number, end: number) {
		this.type = type;
		this.start = start;
		this.end = end;
	}

	get isNamed() {
		return !anonymousTypes.has(this.type);
	}
	get namedChildren(): SyntaxNode[] {
		return this.allChildren.filter((child) => child.isNamed);
	}
	childByFieldName(name: 'key' | 'value'): SyntaxNode | undefined {
		return this.fields.get(name);
	}

	append(child: SyntaxNode, field?: 'key' | 'value') {
		child.parent = this;
		this.allChildren.push(child);
		if (field) this.fields.set(field, child);
	}

	insertSorted(child: SyntaxNode) {
		child.parent = this;
		const index = this.allChildren.findIndex((existing) => existing.start > child.start);
		if (index === -1) this.allChildren.push(child);
		else this.allChildren.splice(index, 0, child);
	}
}

export class YAMLSyntaxError extends Error {
	readonly line: number;
	constructor(message: string, line: number) {
		super(message);
		this.line = line;
	}
}

type SourceToken = CST.SourceToken;
type Token = CST.Token;

const isSourceToken = (token: unknown): token is SourceToken =>
	typeof token === 'object' &&
	token !== null &&
	'source' in token &&
	typeof (token as SourceToken).source === 'string' &&
	!('items' in token);

function plainScalarKind(text: string): SyntaxNodeType {
	if (text.includes('\n')) return 'string_scalar';
	if (/^(null|Null|NULL|~)$/.test(text)) return 'null_scalar';
	if (/^(true|True|TRUE|false|False|FALSE)$/.test(text)) return 'boolean_scalar';
	if (/^([-+]?[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+)$/.test(text)) return 'integer_scalar';
	if (
		/^([-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?|[-+]?\.(inf|Inf|INF)|\.(nan|NaN|NAN))$/.test(
			text
		)
	)
		return 'float_scalar';
	return 'string_scalar';
}

class Builder {
	readonly comments: SyntaxNode[] = [];
	private readonly source: string;
	constructor(source: string) {
		this.source = source;
	}

	collect(tokens: readonly unknown[] | undefined) {
		for (const token of tokens ?? []) {
			if (isSourceToken(token) && token.type === 'comment') {
				this.comments.push(
					new SyntaxNode('comment', token.offset, token.offset + token.source.length)
				);
			}
		}
	}

	props(tokens: readonly SourceToken[]): SyntaxNode[] {
		return tokens
			.filter((token) => token.type === 'anchor' || token.type === 'tag')
			.map(
				(token) =>
					new SyntaxNode(
						token.type === 'anchor' ? 'anchor' : 'tag',
						token.offset,
						token.offset + token.source.length
					)
			);
	}

	wrap(content: SyntaxNode | null, props: SyntaxNode[]): SyntaxNode | null {
		if (!content && props.length === 0) return null;
		const block =
			content !== null &&
			['block_mapping', 'block_sequence', 'block_scalar'].includes(content.type);
		const first = props[0] ?? content;
		const last = content ?? props[props.length - 1];
		const wrapper = new SyntaxNode(block ? 'block_node' : 'flow_node', first!.start, last!.end);
		for (const prop of props) wrapper.append(prop);
		if (content) wrapper.append(content);
		return wrapper;
	}

	content(token: Token | null | undefined): SyntaxNode | null {
		if (!token) return null;
		switch (token.type) {
			case 'scalar': {
				if (token.source === '') {
					this.collect(token.end);
					return null;
				}
				const node = new SyntaxNode(
					'plain_scalar',
					token.offset,
					token.offset + token.source.length
				);
				node.append(new SyntaxNode(plainScalarKind(token.source), node.start, node.end));
				this.collect(token.end);
				return node;
			}
			case 'single-quoted-scalar':
			case 'double-quoted-scalar': {
				this.collect(token.end);
				return new SyntaxNode(
					token.type === 'single-quoted-scalar' ? 'single_quote_scalar' : 'double_quote_scalar',
					token.offset,
					token.offset + token.source.length
				);
			}
			case 'alias':
				this.collect(token.end);
				return new SyntaxNode('alias', token.offset, token.offset + token.source.length);
			case 'block-scalar':
				return this.blockScalar(token);
			case 'block-map':
				return this.blockMap(token);
			case 'block-seq':
				return this.blockSeq(token);
			case 'flow-collection':
				return this.flowCollection(token);
			default:
				return null;
		}
	}

	blockScalar(token: CST.BlockScalar): SyntaxNode {
		const props = token.props.filter(isSourceToken);
		const header = props.find((prop) => prop.type === 'block-scalar-header');
		const start = header?.offset ?? token.offset;
		const newline = props.find((prop) => prop.type === 'newline');
		let headerEnd = newline ? newline.offset : start + (header?.source.length ?? 0);
		while (headerEnd > start && /[ \t\r]/.test(this.source[headerEnd - 1]!)) headerEnd -= 1;
		const bodyStart = newline ? newline.offset + newline.source.length : headerEnd;
		let end = headerEnd;
		let cursor = bodyStart;
		const bodyEnd = bodyStart + token.source.length;
		while (cursor < bodyEnd) {
			let lineEnd = this.source.indexOf('\n', cursor);
			if (lineEnd === -1 || lineEnd > bodyEnd) lineEnd = bodyEnd;
			const line = this.source.slice(cursor, lineEnd).replace(/\r$/, '');
			if (line.trim() !== '') end = cursor + line.length;
			cursor = lineEnd + 1;
		}
		return new SyntaxNode('block_scalar', start, end);
	}

	splitSep(sep: readonly SourceToken[] | undefined) {
		const tokens = sep ?? [];
		const index = tokens.findIndex((token) => token.type === 'map-value-ind');
		if (index === -1) return { colon: undefined, before: tokens, after: [] as SourceToken[] };
		return { colon: tokens[index], before: tokens.slice(0, index), after: tokens.slice(index + 1) };
	}

	trailingProps(start: readonly SourceToken[]): SyntaxNode[] {
		let index = start.length;
		while (index > 0) {
			const type = start[index - 1]!.type;
			if (type === 'seq-item-ind' || type === 'comma' || type === 'explicit-key-ind') break;
			index -= 1;
		}
		return this.props(start.slice(index));
	}

	pair(type: 'block_mapping_pair' | 'flow_pair', item: CST.CollectionItem) {
		this.collect(item.start);
		this.collect(item.sep);
		const key = this.wrap(this.content(item.key), this.trailingProps(item.start));
		const { colon, before, after } = this.splitSep(item.sep as SourceToken[] | undefined);
		const value = this.wrap(this.content(item.value), this.props(after));
		const colonNode = colon ? new SyntaxNode(':', colon.offset, colon.offset + 1) : null;
		const first = key ?? colonNode ?? value;
		const last = value ?? colonNode ?? key;
		if (!first || !last) return null;
		void before;
		const pair = new SyntaxNode(type, first.start, last.end);
		if (key) pair.append(key, 'key');
		if (colonNode) pair.append(colonNode);
		if (value) pair.append(value, 'value');
		return pair;
	}

	blockMap(token: CST.BlockMap): SyntaxNode | null {
		const mapping = new SyntaxNode('block_mapping', 0, 0);
		for (const item of token.items) {
			const pair = this.pair('block_mapping_pair', item);
			if (pair) mapping.append(pair);
		}
		return this.bound(mapping);
	}

	blockSeq(token: CST.BlockSequence): SyntaxNode | null {
		const sequence = new SyntaxNode('block_sequence', 0, 0);
		for (const item of token.items) {
			this.collect(item.start);
			const dash = item.start.find((token) => token.type === 'seq-item-ind');
			const value = this.wrap(this.content(item.value), this.trailingProps(item.start));
			const start = dash?.offset ?? value?.start;
			if (start === undefined) continue;
			const node = new SyntaxNode('block_sequence_item', start, value?.end ?? start + 1);
			if (dash) node.append(new SyntaxNode('-', dash.offset, dash.offset + 1));
			if (value) node.append(value, 'value');
			sequence.append(node);
		}
		return this.bound(sequence);
	}

	flowCollection(token: CST.FlowCollection): SyntaxNode {
		const isMap = token.start.type === 'flow-map-start';
		const node = new SyntaxNode(
			isMap ? 'flow_mapping' : 'flow_sequence',
			token.offset,
			token.offset + 1
		);
		node.append(new SyntaxNode(isMap ? '{' : '[', token.start.offset, token.start.offset + 1));
		for (const item of token.items) {
			for (const source of [item.start, item.sep ?? []]) {
				for (const comma of source.filter((t) => t.type === 'comma'))
					node.append(new SyntaxNode(',', comma.offset, comma.offset + 1));
			}
			const hasColon = (item.sep ?? []).some((t) => t.type === 'map-value-ind');
			if (hasColon) {
				const pair = this.pair('flow_pair', item);
				if (pair) node.append(pair);
				continue;
			}
			this.collect(item.start);
			this.collect(item.sep);
			const props = this.trailingProps(item.start);
			const wrapped = this.wrap(this.content(item.key ?? item.value), props);
			if (wrapped) node.append(wrapped);
		}
		this.collect(token.end);
		const close = token.end.find((t) => t.type === (isMap ? 'flow-map-end' : 'flow-seq-end'));
		if (close) {
			node.append(new SyntaxNode(isMap ? '}' : ']', close.offset, close.offset + 1));
			node.end = close.offset + 1;
		}
		node.allChildren.sort((a, b) => a.start - b.start);
		return node;
	}

	bound(node: SyntaxNode): SyntaxNode | null {
		const first = node.allChildren[0];
		const last = node.allChildren[node.allChildren.length - 1];
		if (!first || !last) return null;
		node.start = first.start;
		node.end = last.end;
		return node;
	}

	placeComments(root: SyntaxNode) {
		for (const comment of this.comments) {
			let container = root;
			for (;;) {
				const next = container.allChildren.find(
					(child) =>
						commentContainers.has(child.type) &&
						child.start <= comment.start &&
						comment.end <= child.end
				);
				if (!next) break;
				container = next;
			}
			container.insertSorted(comment);
		}
	}
}

export type ParsedSyntax = { root: SyntaxNode; documentCount: number };

export function parseSyntax(source: string): ParsedSyntax {
	const documents = parseAllDocuments(source, { uniqueKeys: false, prettyErrors: true });
	const list = Array.isArray(documents) ? documents : [documents];
	for (const document of list) {
		const error = document.errors[0];
		if (error) throw new YAMLSyntaxError(error.message, error.linePos?.[0].line ?? 1);
	}
	const builder = new Builder(source);
	const root = new SyntaxNode('stream', 0, source.length);
	let documentCount = 0;
	for (const token of new Parser().parse(source)) {
		if (token.type === 'document') {
			documentCount += 1;
			builder.collect(token.start);
			builder.collect(token.end);
			const props = builder.props(token.start);
			const value = builder.wrap(builder.content(token.value), props);
			if (value) {
				const document = new SyntaxNode('document', value.start, value.end);
				document.append(value);
				root.append(document);
			}
		} else if (token.type === 'error') {
			throw new YAMLSyntaxError(token.message, 1);
		} else if (isSourceToken(token)) {
			builder.collect([token]);
		}
	}
	builder.placeComments(root);
	return { root, documentCount };
}
