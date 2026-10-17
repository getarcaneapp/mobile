import ExpoModulesCore
import Foundation
import Security

public class ArcaneCloudSyncModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArcaneCloudSync")

    AsyncFunction("getStatus") { () -> [String: Bool] in
      var query = Keychain.baseQuery(service: Keychain.probeService, account: nil, accessGroup: nil)
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      let status = SecItemCopyMatching(query as CFDictionary, nil)
      let available = status == errSecSuccess || status == errSecItemNotFound
      return ["available": available, "cloudBackup": available]
    }

    AsyncFunction("getItem") { (service: String, account: String, accessGroup: String?) throws -> String? in
      var query = Keychain.baseQuery(service: service, account: account, accessGroup: accessGroup)
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      query[kSecReturnData as String] = true

      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)
      if status == errSecItemNotFound { return nil }
      guard status == errSecSuccess, let data = result as? Data else {
        throw KeychainException(status == errSecSuccess ? errSecDecode : status)
      }
      guard let value = String(data: data, encoding: .utf8) else {
        throw KeychainException(errSecDecode)
      }
      return value
    }

    AsyncFunction("setItem") {
      (service: String, account: String, value: String, accessGroup: String?, accessible: String?) throws in
      let query = Keychain.baseQuery(service: service, account: account, accessGroup: accessGroup)
      var update: [String: Any] = [kSecValueData as String: Data(value.utf8)]
      let protection = try Keychain.accessibility(accessible)
      if accessible == "whenUnlocked" {
        update[kSecAttrAccessible as String] = protection
      }

      let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
      if updateStatus == errSecSuccess { return }
      guard updateStatus == errSecItemNotFound else { throw KeychainException(updateStatus) }

      var item = query
      update.forEach { item[$0.key] = $0.value }
      item[kSecAttrAccessible as String] = protection
      let addStatus = SecItemAdd(item as CFDictionary, nil)
      if addStatus == errSecDuplicateItem {
        let retryStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        guard retryStatus == errSecSuccess else { throw KeychainException(retryStatus) }
        return
      }
      guard addStatus == errSecSuccess else { throw KeychainException(addStatus) }
    }

    AsyncFunction("deleteItem") { (service: String, account: String, accessGroup: String?) throws in
      let query = Keychain.baseQuery(service: service, account: account, accessGroup: accessGroup)
      let status = SecItemDelete(query as CFDictionary)
      guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainException(status) }
    }

    AsyncFunction("getAllItems") { (service: String, accessGroup: String?) throws -> [String: String] in
      let items = try Keychain.matchAll(service: service, accessGroup: accessGroup, returnData: true)
      var values: [String: String] = [:]
      for item in items {
        guard let account = item[kSecAttrAccount as String] as? String,
          let data = item[kSecValueData as String] as? Data,
          let value = String(data: data, encoding: .utf8)
        else { continue }
        values[account] = value
      }
      return values
    }

    AsyncFunction("listAccounts") { (service: String, accessGroup: String?) throws -> [String] in
      try Keychain.matchAll(service: service, accessGroup: accessGroup, returnData: false)
        .compactMap { $0[kSecAttrAccount as String] as? String }
    }
  }
}

private enum Keychain {
  static let probeService = "app.getarcane.mobile.cloud-sync.probe"

  static func baseQuery(service: String, account: String?, accessGroup: String?) -> [String: Any] {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrSynchronizable as String: kCFBooleanTrue as Any,
    ]
    if let account { query[kSecAttrAccount as String] = account }
    if let accessGroup, !accessGroup.isEmpty { query[kSecAttrAccessGroup as String] = accessGroup }
    return query
  }

  static func accessibility(_ value: String?) throws -> CFString {
    switch value {
    case nil, "afterFirstUnlock": return kSecAttrAccessibleAfterFirstUnlock
    case "whenUnlocked": return kSecAttrAccessibleWhenUnlocked
    case let other?: throw InvalidAccessibilityException(other)
    }
  }

  static func matchAll(service: String, accessGroup: String?, returnData: Bool) throws -> [[String: Any]] {
    var query = baseQuery(service: service, account: nil, accessGroup: accessGroup)
    query[kSecMatchLimit as String] = kSecMatchLimitAll
    query[kSecReturnAttributes as String] = kCFBooleanTrue as Any
    if returnData { query[kSecReturnData as String] = kCFBooleanTrue as Any }

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return [] }
    guard status == errSecSuccess else { throw KeychainException(status) }
    if let matches = result as? [[String: Any]] { return matches }
    if let match = result as? [String: Any] { return [match] }
    throw KeychainException(errSecDecode)
  }
}

private final class KeychainException: GenericException<OSStatus> {
  override var code: String { "ERR_KEYCHAIN" }
  override var reason: String {
    let message = SecCopyErrorMessageString(param, nil) as String? ?? "Unknown error"
    return "Keychain error \(param): \(message)"
  }
}

private final class InvalidAccessibilityException: GenericException<String> {
  override var code: String { "ERR_INVALID_ACCESSIBLE" }
  override var reason: String { "Unsupported keychain accessibility '\(param)'" }
}
