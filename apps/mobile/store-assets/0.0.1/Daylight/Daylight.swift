import SwiftUI

@main struct DaylightApp: App {
    var body: some Scene { WindowGroup { DaylightView() } }
}
struct DaylightView: View {
    @State private var completed = false
    private let ink = Color(red: 0.17, green: 0.23, blue: 0.19)
    private let sage = Color(red: 0.79, green: 0.84, blue: 0.72)
    var body: some View {
        VStack(alignment: .leading, spacing: 26) {
            HStack {
                Label("daylight", systemImage: "sun.max").font(.system(size: 23, weight: .semibold, design: .rounded))
                Spacer()
                Image(systemName: "person.crop.circle").font(.title2)
            }.padding(.top, 14)
            VStack(alignment: .leading, spacing: 8) {
                Text("MONDAY, SEPTEMBER 14").font(.system(size: 11, weight: .semibold)).tracking(2).foregroundStyle(.secondary)
                Text("Make room for\na little good.").font(.system(size: 38, weight: .regular, design: .serif)).lineSpacing(-2).fixedSize(horizontal: false, vertical: true)
            }
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 14) {
                    Text("TODAY’S INTENTION").font(.system(size: 10, weight: .semibold)).tracking(1.6)
                    Text("Less rush.\nMore presence.").font(.system(size: 28, design: .serif)).fixedSize(horizontal: false, vertical: true)
                    Label("One moment at a time", systemImage: "leaf").font(.system(size: 12))
                }
                Spacer()
                Image(systemName: "sun.horizon").font(.system(size: 48, weight: .ultraLight)).padding(.trailing, 4)
            }.padding(24).frame(maxWidth: .infinity, alignment: .leading).background(sage, in: RoundedRectangle(cornerRadius: 24))
            HStack { Text("Your small rituals").font(.system(size: 22, weight: .medium, design: .serif)); Spacer(); Text(completed ? "2 of 3" : "1 of 3").font(.caption).foregroundStyle(.secondary) }
            VStack(spacing: 0) {
                ritual("A glass of water", detail: "Start fresh · 2 min", icon: "drop", done: true)
                Divider().padding(.leading, 52)
                Button { completed.toggle() } label: { ritual("Step outside", detail: "Find a little light · 10 min", icon: "sun.max", done: completed) }.buttonStyle(.plain)
                Divider().padding(.leading, 52)
                ritual("Write a few lines", detail: "Clear your mind · 5 min", icon: "pencil.line", done: false)
            }
            Spacer(minLength: 0)
            HStack {
                nav("Today", icon: "sun.max.fill", selected: true)
                Spacer()
                nav("Journal", icon: "book.closed", selected: false)
                Spacer()
                nav("Progress", icon: "chart.bar", selected: false)
            }.padding(.horizontal, 22).padding(.top, 18).overlay(alignment: .top) { Rectangle().fill(ink.opacity(0.12)).frame(height: 1) }
        }.padding(.horizontal, 28).padding(.bottom, 12).foregroundStyle(ink).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(red: 0.97, green: 0.96, blue: 0.93)).preferredColorScheme(.light)
    }
    private func ritual(_ name: String, detail: String, icon: String, done: Bool) -> some View {
        HStack(spacing: 16) {
            Image(systemName: icon).font(.system(size: 23, weight: .light)).frame(width: 34)
            VStack(alignment: .leading, spacing: 5) { Text(name).font(.system(size: 16, weight: .medium)); Text(detail).font(.system(size: 12)).foregroundStyle(.secondary) }
            Spacer()
            Image(systemName: done ? "checkmark.circle.fill" : "circle").font(.system(size: 22, weight: .light)).foregroundStyle(done ? ink : ink.opacity(0.25))
        }.padding(.vertical, 17)
    }
    private func nav(_ label: String, icon: String, selected: Bool) -> some View {
        VStack(spacing: 6) { Image(systemName: icon).font(.system(size: 20)); Text(label).font(.system(size: 10, weight: .medium)) }.opacity(selected ? 1 : 0.45)
    }
}
