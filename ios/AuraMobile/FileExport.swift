import Foundation
import React
import UIKit

/// Saves a small text file through the system "Save to Files" sheet. It is the save sheet and not the share sheet on purpose: the
/// share sheet would offer AirDrop, Messages and Mail next to a password. The file is written to a private temporary folder with
/// complete file protection (readable only while the device is unlocked), handed to the sheet as a copy, and removed afterwards.
@objc(FileExport)
final class FileExport: NSObject, UIDocumentPickerDelegate {
  private var resolve: RCTPromiseResolveBlock?
  private var folder: URL?
  private static let prefix = "file-export-"

  @objc static func requiresMainQueueSetup() -> Bool { true }

  /// Whether this device is signed in to iCloud (so a file saved to iCloud Drive can reach a Mac).
  @objc(iCloudSignedIn:rejecter:)
  func iCloudSignedIn(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    resolve(FileManager.default.ubiquityIdentityToken != nil)
  }

  /// Removes any export folder an earlier run left behind, for example if the app was closed while the sheet was open.
  @objc(sweep:rejecter:)
  func sweep(_ resolve: RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    let tmp = FileManager.default.temporaryDirectory
    let items = (try? FileManager.default.contentsOfDirectory(atPath: tmp.path)) ?? []
    var removed = 0
    for name in items where name.hasPrefix(Self.prefix) {
      try? FileManager.default.removeItem(at: tmp.appendingPathComponent(name))
      removed += 1
    }
    resolve(removed)
  }

  @objc(saveText:contents:resolver:rejecter:)
  func saveText(_ filename: String, contents: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.resolve == nil else { reject("busy", "A save is already in progress.", nil); return }
      let safeName = filename.replacingOccurrences(of: "/", with: "-").trimmingCharacters(in: .whitespaces)
      guard !safeName.isEmpty else { reject("bad_name", "The file needs a name.", nil); return }
      let dir = FileManager.default.temporaryDirectory.appendingPathComponent(Self.prefix + UUID().uuidString, isDirectory: true)
      do {
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        let url = dir.appendingPathComponent(safeName)
        try Data(contents.utf8).write(to: url, options: [.completeFileProtection, .atomic])
        self.folder = dir
        self.resolve = resolve
        let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
        picker.delegate = self
        self.present(picker, attemptsLeft: 12)
      } catch {
        try? FileManager.default.removeItem(at: dir)
        reject("write_failed", "Could not prepare the file.", error)
      }
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    finish(saved: true, name: urls.first?.lastPathComponent, error: nil)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    finish(saved: false, name: nil, error: nil)
  }

  private func finish(saved: Bool, name: String?, error: String?) {
    if let folder = folder {
      try? FileManager.default.removeItem(at: folder)
    }
    folder = nil
    let done = resolve
    resolve = nil
    done?(["saved": saved, "name": name as Any, "error": error as Any])
  }

  /// Shows the sheet on the front-most screen. Right after Face ID iOS can still report the app as inactive, so this accepts an
  /// inactive scene and tries again a few times (about three seconds) before giving up.
  private func present(_ picker: UIDocumentPickerViewController, attemptsLeft: Int) {
    if let top = Self.topViewController() {
      top.present(picker, animated: true)
    } else if attemptsLeft > 0 {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { self.present(picker, attemptsLeft: attemptsLeft - 1) }
    } else {
      finish(saved: false, name: nil, error: "no screen to show the sheet on")
    }
  }

  private static func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first { $0.activationState == .foregroundInactive } ?? scenes.first
    let window = scene?.windows.first(where: { $0.isKeyWindow }) ?? scene?.windows.first
    var top = window?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}
