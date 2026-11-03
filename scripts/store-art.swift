// Draws the App Store "product page header" (21:9) and "search results" (3:2) images from the app icon and two screenshots.
//
//   swift scripts/store-art.swift <icon.png> <screenshot-left.png> <screenshot-right.png> <output folder> ["Tagline text"]
//
// Sizes follow Apple's creative asset specifications: header 3840 x 1646, search results 3840 x 2560 (3:2, between 1920 x 1280 and
// 3840 x 2560). The images have no alpha channel, which Apple requires. The name shown is read from the app itself, so it follows a rename.
import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

struct Spec {
    let file: String
    let width: Int
    let height: Int
}

let specs = [
    Spec(file: "header-21x9-3840x1646.png", width: 3840, height: 1646),
    Spec(file: "search-results-3x2-3840x2560.png", width: 3840, height: 2560),
]

let args = CommandLine.arguments
guard args.count >= 5 else {
    FileHandle.standardError.write(Data("usage: store-art.swift <icon> <left screenshot> <right screenshot> <output folder> [tagline]\n".utf8))
    exit(2)
}
let tagline = args.count > 5 ? args[5] : "Manage your cloud graph databases from your phone"
/// The name people see, read from the app's Info.plist (run this from the repository root).
let plistPath = FileManager.default.currentDirectoryPath + "/ios/AuraMobile/Info.plist"
guard let plist = NSDictionary(contentsOfFile: plistPath), let appName = plist["CFBundleDisplayName"] as? String else {
    FileHandle.standardError.write(Data("cannot read CFBundleDisplayName from \(plistPath): run this from the repository root\n".utf8))
    exit(1)
}

func load(_ path: String) -> CGImage {
    guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        FileHandle.standardError.write(Data("cannot read \(path)\n".utf8))
        exit(1)
    }
    return image
}

let icon = load(args[1])
let shots = [load(args[2]), load(args[3])]
let outDir = URL(fileURLWithPath: args[4], isDirectory: true)
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

func roundedPath(_ rect: CGRect, _ radius: CGFloat) -> CGPath {
    CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

/// One phone: a dark bezel with the screenshot inside it, and a soft shadow.
func drawPhone(_ ctx: CGContext, _ shot: CGImage, in rect: CGRect) {
    let bezel = rect.width * 0.028
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -rect.height * 0.018), blur: rect.height * 0.05, color: CGColor(red: 0, green: 0.05, blue: 0.12, alpha: 0.45))
    ctx.addPath(roundedPath(rect, rect.width * 0.17))
    ctx.setFillColor(CGColor(red: 0.07, green: 0.09, blue: 0.12, alpha: 1))
    ctx.fillPath()
    ctx.restoreGState()

    let screen = rect.insetBy(dx: bezel, dy: bezel)
    ctx.saveGState()
    ctx.addPath(roundedPath(screen, screen.width * 0.145))
    ctx.clip()
    ctx.draw(shot, in: screen)
    ctx.restoreGState()
}

func render(_ spec: Spec) {
    let w = CGFloat(spec.width), h = CGFloat(spec.height)
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    // noneSkipLast: no alpha channel in the result
    guard let ctx = CGContext(data: nil, width: spec.width, height: spec.height, bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { exit(1) }

    let gradient = CGGradient(colorsSpace: space, colors: [CGColor(red: 0.035, green: 0.28, blue: 0.45, alpha: 1), CGColor(red: 0.10, green: 0.55, blue: 0.76, alpha: 1)] as CFArray, locations: [0, 1])!
    ctx.drawLinearGradient(gradient, start: CGPoint(x: 0, y: h), end: CGPoint(x: w, y: 0), options: [])

    // Everything stays well inside the edges, so the art survives the crops Apple applies on different devices
    let marginX = w * 0.075
    let phoneH = h * 0.76
    let phoneW = phoneH * 1206.0 / 2622.0
    let gap = phoneW * 0.10
    let phonesWidth = phoneW * 2 + gap
    let phonesLeft = w - marginX - phonesWidth
    let baseY = (h - phoneH) / 2
    drawPhone(ctx, shots[0], in: CGRect(x: phonesLeft, y: baseY + h * 0.035, width: phoneW, height: phoneH))
    drawPhone(ctx, shots[1], in: CGRect(x: phonesLeft + phoneW + gap, y: baseY - h * 0.035, width: phoneW, height: phoneH))

    // Text block on the left: icon, name, one clear line
    let textWidth = phonesLeft - marginX * 1.7
    let iconSize = h * 0.17
    let titleFont = NSFont.systemFont(ofSize: h * 0.17, weight: .bold)
    let tagFont = NSFont.systemFont(ofSize: h * 0.062, weight: .medium)
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = h * 0.008
    let titleAttrs: [NSAttributedString.Key: Any] = [.font: titleFont, .foregroundColor: NSColor.white]
    let tagAttrs: [NSAttributedString.Key: Any] = [.font: tagFont, .foregroundColor: NSColor(white: 1, alpha: 0.92), .paragraphStyle: paragraph]
    let title = NSAttributedString(string: appName, attributes: titleAttrs)
    let tag = NSAttributedString(string: tagline, attributes: tagAttrs)
    let titleH = title.boundingRect(with: CGSize(width: textWidth, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin]).height
    let tagH = tag.boundingRect(with: CGSize(width: textWidth, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin]).height
    let gap1 = h * 0.04, gap2 = h * 0.02
    let blockH = iconSize + gap1 + titleH + gap2 + tagH
    var y = (h + blockH) / 2 // top of the block; this context's origin is bottom left

    y -= iconSize
    let iconRect = CGRect(x: marginX, y: y, width: iconSize, height: iconSize)
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -iconSize * 0.05), blur: iconSize * 0.12, color: CGColor(red: 0, green: 0.05, blue: 0.12, alpha: 0.35))
    ctx.addPath(roundedPath(iconRect, iconSize * 0.2237))
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fillPath()
    ctx.restoreGState()
    ctx.saveGState()
    ctx.addPath(roundedPath(iconRect, iconSize * 0.2237))
    ctx.clip()
    ctx.draw(icon, in: iconRect)
    ctx.restoreGState()

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: false)
    y -= gap1 + titleH
    title.draw(with: CGRect(x: marginX, y: y, width: textWidth, height: titleH), options: [.usesLineFragmentOrigin])
    y -= gap2 + tagH
    tag.draw(with: CGRect(x: marginX, y: y, width: textWidth, height: tagH), options: [.usesLineFragmentOrigin])
    NSGraphicsContext.restoreGraphicsState()

    guard let image = ctx.makeImage() else { exit(1) }
    let url = outDir.appendingPathComponent(spec.file)
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(1) }
    CGImageDestinationAddImage(dest, image, nil)
    if !CGImageDestinationFinalize(dest) { exit(1) }
    print("wrote \(url.path)")
}

specs.forEach(render)
