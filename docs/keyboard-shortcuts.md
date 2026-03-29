# Keyboard Shortcut Map

This branch turns the design todo into a real shortcut system with a clear contract:

- ship the shortcuts the current UI can support without hacks
- reserve stable bindings for memory, search, and files before those panels land
- keep the map visible with a `?` overlay so power-user features stay discoverable

## Available now

| Shortcut               | Action                     | Notes                                                    |
| ---------------------- | -------------------------- | -------------------------------------------------------- |
| `Cmd/Ctrl + N`         | New chat                   | Clears the active thread and resets to an empty composer |
| `Cmd/Ctrl + Shift + S` | Toggle sidebar             | Opens or closes the conversation drawer                  |
| `Cmd/Ctrl + /`         | Focus model selector       | Jumps to the selected model pill                         |
| `?`                    | Open shortcut overlay      | Only outside text inputs so typing isn't interrupted     |
| `Esc`                  | Close overlay/sidebar      | Dismisses top-level UI chrome                            |
| `Left/Right`           | Switch models              | Works once the model selector has focus                  |
| `Up/Down`              | Move through conversations | Works inside the sidebar conversation list               |
| `Enter`                | Send message               | Existing composer behavior                               |
| `Shift + Enter`        | New line                   | Existing composer behavior                               |

## Reserved for next panels

| Shortcut               | Future target | Why reserve it now                                      |
| ---------------------- | ------------- | ------------------------------------------------------- |
| `Cmd/Ctrl + Shift + M` | Memory        | Matches the design todo and keeps memory one chord away |
| `Cmd/Ctrl + K`         | Search        | Aligns with the MVP design doc's global search overlay  |
| `Cmd/Ctrl + Shift + F` | Files         | Keeps the panel map symmetrical with memory             |

## Design constraints learned here

- `?` must never hijack normal typing, so it only opens help when focus is outside editable fields.
- Shortcut discoverability matters almost as much as the bindings themselves. The overlay is not optional if the product is aiming at keyboard-first developers.
- The map should grow by adding panels to reserved slots, not by reassigning keys after users build muscle memory.
