import SwiftUI

struct NestedModalView: View {
    @Bindable var store: AppStore
    
    var body: some View {
        if let activeNodeID = store.modalStack.last,
           store.nodes.contains(where: { $0.id == activeNodeID }) {
            
            VStack(spacing: 0) {
                // Modal Navigation Bar / Breadcrumbs
                HStack(spacing: 12) {
                    // Back button
                    Button(action: {
                        _ = store.modalStack.popLast()
                    }) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("Back")
                        }
                        .fontWeight(.semibold)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.regular)
                    
                    Divider()
                        .frame(height: 20)
                    
                    // Breadcrumbs
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            let path = getBreadcrumbPath(for: activeNodeID)
                            ForEach(Array(path.enumerated()), id: \.offset) { index, ancestor in
                                if index > 0 {
                                    Image(systemName: "chevron.right")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                                
                                Button(action: {
                                    // Jump back to this level by trimming the stack
                                    if let stackIndex = store.modalStack.firstIndex(of: ancestor.id) {
                                        store.modalStack = Array(store.modalStack[0...stackIndex])
                                    }
                                }) {
                                    Text(ancestor.title)
                                        .fontWeight(ancestor.id == activeNodeID ? .bold : .regular)
                                        .foregroundColor(ancestor.id == activeNodeID ? .primary : .blue)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    
                    Spacer()
                    
                    // Close All button
                    Button(action: {
                        store.modalStack.removeAll()
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                    .keyboardShortcut(.escape, modifiers: [])
                }
                .padding()
                .background(Color(NSColor.windowBackgroundColor))
                
                Divider()
                
                // Split Chat Workspace and Child Node list
                HStack(spacing: 0) {
                    // Middle Chat Area
                    ChatView(nodeID: activeNodeID, store: store)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    
                    Divider()
                    
                    // Right Sidebar showing child concepts of this nested node
                    ChildNodesListView(parentID: activeNodeID, store: store)
                        .frame(maxHeight: .infinity)
                }
            }
            .background(Color(NSColor.underPageBackgroundColor))
            .cornerRadius(12)
            .shadow(radius: 15)
            .transition(.scale.combined(with: .opacity))
        }
    }
    
    private func getBreadcrumbPath(for nodeID: UUID) -> [ConceptNode] {
        var path: [ConceptNode] = []
        var currentID: UUID? = nodeID
        while let id = currentID, let node = store.nodes.first(where: { $0.id == id }) {
            path.insert(node, at: 0)
            currentID = node.parentID
        }
        return path
    }
}
