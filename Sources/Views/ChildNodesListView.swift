import SwiftUI

struct ChildNodesListView: View {
    let parentID: UUID
    @Bindable var store: AppStore
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Nested Concepts")
                .font(.headline)
                .foregroundColor(.secondary)
                .padding(.horizontal)
                .padding(.top, 16)
            
            let children = store.getChildNodes(for: parentID)
            
            if children.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "square.dashed")
                        .font(.largeTitle)
                        .foregroundColor(.secondary.opacity(0.5))
                    Text("No nested concepts here yet.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("Highlight/copy a word and click '+' in the input bar to spawn one.")
                        .font(.caption2)
                        .foregroundColor(.secondary.opacity(0.8))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(children) { child in
                            ChildNodeCard(node: child, store: store)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 16)
                }
            }
        }
        .frame(width: 250)
        .background(Color(NSColor.underPageBackgroundColor).opacity(0.5))
    }
}

// MARK: - Individual Card View

struct ChildNodeCard: View {
    let node: ConceptNode
    let store: AppStore
    
    @State private var isHovering = false
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: node.status == .mastered ? "checkmark.circle.fill" : "brain.head.profile")
                        .foregroundColor(node.status == .mastered ? .green : .orange)
                    Text(node.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                        .foregroundColor(node.status == .mastered ? .green.opacity(0.8) : .orange.opacity(0.8))
                }
                
                let msgCount = node.messages.count
                Text("\(msgCount) message\(msgCount == 1 ? "" : "s")")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Delete button
            if isHovering {
                Button(action: {
                    store.deleteNode(id: node.id)
                }) {
                    Image(systemName: "trash")
                        .foregroundColor(.red.opacity(0.7))
                        .font(.caption)
                }
                .buttonStyle(.plain)
                .transition(.opacity)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(node.status == .mastered ? Color.green.opacity(0.08) : Color.yellow.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(
                            node.status == .mastered ? Color.green.opacity(0.2) : Color.yellow.opacity(0.3),
                            lineWidth: isHovering ? 2 : 1
                        )
                )
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovering = hovering
            }
        }
        .onTapGesture {
            // Push node onto modal stack!
            store.modalStack.append(node.id)
        }
        .help("Click to open nested explanation for '\(node.title)'")
    }
}
