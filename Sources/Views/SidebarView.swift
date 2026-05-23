import SwiftUI

struct SidebarView: View {
    @Bindable var store: AppStore
    @Binding var showSettings: Bool
    
    @State private var showNewDialog = false
    @State private var newTopicText = ""
    @FocusState private var isFieldFocused: Bool
    
    var body: some View {
        VStack(spacing: 0) {
            // App Title Banner
            HStack {
                Image(systemName: "square.stack.3d.up.fill")
                    .font(.title2)
                    .foregroundStyle(.blue.gradient)
                Text("ConceptNest")
                    .font(.title3)
                    .fontWeight(.bold)
                Spacer()
            }
            .padding()
            
            Divider()
            
            // New Session Action
            Button(action: {
                newTopicText = ""
                showNewDialog = true
            }) {
                HStack {
                    Image(systemName: "plus.circle.fill")
                    Text("New Study Topic")
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(.blue)
            .padding()
            
            // Conversation List
            let roots = store.nodes.filter { $0.parentID == nil }
                .sorted(by: { $0.timestamp > $1.timestamp })
            
            if roots.isEmpty {
                VStack {
                    Spacer()
                    Text("No topics yet")
                        .foregroundColor(.secondary)
                    Spacer()
                }
            } else {
                List(roots, selection: $store.selectedRootNodeID) { root in
                    HStack {
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                            .foregroundColor(.blue.opacity(0.8))
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(root.title)
                                .font(.body)
                                .lineLimit(1)
                            Text(root.timestamp.formatted(.dateTime.month().day().hour().minute()))
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .tag(root.id)
                    .contextMenu {
                        Button(role: .destructive, action: {
                            store.deleteNode(id: root.id)
                        }) {
                            Text("Delete Topic")
                            Image(systemName: "trash")
                        }
                    }
                }
                .listStyle(.sidebar)
            }
            
            Spacer()
            
            Divider()
            
            // Bottom Toolbar (Settings)
            HStack {
                Button(action: {
                    showSettings = true
                }) {
                    HStack {
                        Image(systemName: "gearshape")
                        Text("Settings")
                    }
                    .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                
                Spacer()
                
                // Active configuration helper
                if store.apiKey.isEmpty {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .help("API Key is missing")
                } else {
                    Text(store.selectedModel)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .padding()
            .background(Color(NSColor.windowBackgroundColor).opacity(0.5))
        }
        .frame(minWidth: 220)
        .sheet(isPresented: $showNewDialog) {
            VStack(spacing: 16) {
                Text("Start New Study Topic")
                    .font(.headline)
                
                TextField("Enter topic (e.g. Deep Learning)", text: $newTopicText)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 250)
                    .focused($isFieldFocused)
                    .onAppear {
                        isFieldFocused = true
                    }
                
                HStack {
                    Button("Cancel") {
                        showNewDialog = false
                    }
                    .keyboardShortcut(.cancelAction)
                    
                    Button("Start") {
                        if !newTopicText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            store.createNewRootNode(title: newTopicText)
                        }
                        showNewDialog = false
                    }
                    .buttonStyle(.borderedProminent)
                    .keyboardShortcut(.defaultAction)
                    .disabled(newTopicText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .padding()
            .frame(width: 300, height: 150)
        }
    }
}
