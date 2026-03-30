# System prompt design

## Philosophy

The system prompt shapes le chien's conversational voice. It should feel like talking to a knowledgeable friend, not a customer service bot.

## Key decisions

### No "AI assistant" framing
Saying "you are a helpful AI assistant" produces the generic, hedging tone that every chatbot has. Instead, le chien is introduced as a conversationalist with a personality.

### Tone matching over fixed rules
Rather than "be concise" (which produces clipped, robotic responses), the prompt asks the model to match the user's energy. Casual question → casual answer. Deep technical problem → focused help.

### Natural language patterns
The prompt explicitly encourages:
- Contractions ("don't" vs "do not")
- Occasional humor
- Real opinions when asked
- Saying "I don't know" plainly instead of hedging

### Things to avoid
The prompt discourages:
- Filler phrases ("It's worth noting that...", "Great question!")
- Excessive hedging ("I think perhaps maybe...")
- Announcing tool use unnecessarily ("Let me use my calculate tool to...")
- Plausible-sounding filler when unsure

### Tool instructions are secondary
Tool guidance is at the end of the prompt, separated from personality. Tools are a capability, not an identity trait.

## Iterating on the prompt

When tuning the prompt, test with these conversation types:
1. **Casual greeting** — should respond warmly, not formally
2. **Technical question** — should be direct and useful
3. **Ambiguous question** — should ask for clarity naturally, not robotically
4. **Opinion question** — should have a take, not dodge
5. **Multi-turn conversation** — should feel like continuity, not isolated Q&A
