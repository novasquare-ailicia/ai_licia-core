# Introducing the ai_licia Official npm Package: Connect Your Games and Tools to Your AI Co-Host

*Today marks an exciting milestone for streamers and developers as we launch our first official npm package, making it easier than ever to integrate ai_licia, your AI Twitch co-host, into your favorite games, tools, and streaming platforms.*

![ai_licia integration with games and tools](https://www.getailicia.com/images/ai_licia-api-banner.jpg)

## Empowering the Community with Open Source

In the past, we've built custom integrations with select partners to connect ai_licia with popular streaming tools and games. These collaborations have produced amazing results: real-time ai_licia reactions to Microsoft Flight Simulator events, dynamic responses to your Spotify playlist changes, and witty commentary during League of Legends matches.

But we wanted to take this a step further.

**Today, we're thrilled to announce that we've open-sourced our official ai_licia client library**. This means anyone, from professional developers to curious streamers who dabble in code, can now easily connect ai_licia to virtually any game, app, or streaming tool.

By releasing this as an npm package, we're making it simple to add ai_licia's interactive capabilities to your existing setup with just a few lines of code.

## What Can You Build with the ai_licia Client?

Here are some ideas to spark your imagination:

### For Streamers:

- Create custom channel point redemptions that trigger ai_licia reactions
- Let ai_licia comment on your gameplay based on in-game events
- Make ai_licia aware of contextual information about your setup (light status, PC overload, active scenes)

### For Game Developers:

- Build official game integrations that feed real-time game state to ai_licia
- Create dialogue between ai_licia and your game's characters
- Have ai_licia act as a live commentator for tournaments
- Use ai_licia to enhance in game tips experiences with contextual help, creating more stream engagement.

### For Streaming Tool Creators:

- Add ai_licia capabilities to your existing streaming toolkit
- Use ai_licia to alert about your action and have her react to them (donations, stream activity, polls, roulette, etc)
- Add contextual information from your tool, pronouns of the viewers in chat, status of a streamathon, etc

## How Does It Work? (The Simple Version)

Our new npm package makes it incredibly easy to connect with ai_licia's API even if you're not a professional developer. Here's the basic idea:

1. **ai_licia can understand your stream's context**: Send information about what's happening in your game, your music, or your stream setup. ai_licia will remember this and use it to craft more relevant responses during your stream.

2. **ai_licia can react immediately to specific moments**: When something exciting happens, like defeating a boss or reaching a milestone, you can trigger ai_licia to comment on it right away.

It's really that simple! These two core functions open up a world of possibilities.

## Real-World Examples in Action

Let's look at some practical examples of how streamers are already using these integrations:

### Flight Simulator Integration

When flying in Microsoft Flight Simulator, ai_licia receives real-time data about altitude, speed, and location. When the streamer performs a particularly smooth landing, the game automatically triggers ai_licia to comment on it, creating a more immersive and entertaining experience.

*"Flying with ai_licia as my co-pilot has completely transformed my Flight Simulator streams. When I hit turbulence, she gets nervous. When I nail a landing, she celebrates with me. It feels like I'm flying with a friend!" - Youba, Twitch Partner* {We should ask a quote from Edson or use one we have}

### Music Commentary with Spotify

With our Spotify integration, ai_licia knows what song is currently playing and can comment on your music taste, or make recommendations. When a new song starts, she might share a fun fact about the artist or react to genre changes.

*"My viewers absolutely love when ai_licia roasts my music choices! Last week I played some 80s hair metal and her reaction had my chat rolling with laughter." - Youba, Twitch Streamer* {We need to find one}

### League of Legends Play-by-Play

During League of Legends matches, ai_licia receives data about kills, deaths, objectives, and game state. She can provide commentary on impressive plays, offer sympathetic words after a tough team fight, celebrate when you secure Baron, or roast you if you failed baddly.

## Connecting with Popular Streaming Tools

Our new package makes it easy to connect ai_licia with the tools you already use:

### Streamer.bot

Build complex workflows where ai_licia responds to specific viewer actions, channel point redemptions, or stream events. Combine ai_licia's AI capabilities with Streamer.bot's powerful automation tools.

### Lumia Stream

Connect your smart lighting system to ai_licia so she can control your room's ambiance based on game events or stream milestones. Imagine your lights turning red while ai_licia gets excited about an intense boss fight.

### Aitum

## Getting Started (No Computer Science Degree Required)

Even if you're not a developer, our npm package is designed to be accessible. Here's how to get started:

1. **Get your API key** from your ai_licia dashboard
2. **Install the package** with a simple command: `npm install ai_licia-client`
3. **Write a few lines of code** to connect ai_licia to your favorite tool or game

We've created detailed tutorials for popular integrations on our [documentation site](https://docs.getailicia.com), with more being added regularly.

For those who want to see code examples right away:

```typescript
// Send context to ai_licia (what's happening in your game/stream)
await client.sendEvent('Player health: 85%, Position: Forest of Doom, Kills: 12');

// Trigger an immediate reaction from ai_licia
await client.triggerGeneration('Player just defeated the dragon boss!');
```

## Join Our Community of Creators

By making our client library open source, we're inviting you to join us in building the future of interactive streaming. Whether you're creating your personal integration or developing a tool for the broader community, we want to see what you build.

We've already seen incredible creativity from early adopters:

- A horror game streamer who connected ai_licia to their heart rate monitor
- A chess streamer who feeds board positions to ai_licia for commentary
- A coding streamer who has ai_licia review and joke about their code

### Share Your Creations

Built something cool with the ai_licia client? Share it on Twitter with #ailiciaIntegration or join our [Discord community](https://discord.gg/Pbh7bYPJKt) to showcase your work.

### Looking for Partners

We're actively seeking partnerships with game studios, app developers, and streaming tool creators who want to build official, branded integrations with ai_licia. Official partners receive:

- Co-marketing opportunities
- Technical support from our development team
- Potential for custom API enhancements
- Featured placement in our documentation

To discuss partnership opportunities, join our Discord and message in the #general channel.

## The Future of ai_licia Integrations

This npm package release is just the beginning. Our roadmap includes:

- More programming language support beyond JavaScript/TypeScript
- Enhanced documentation and example projects
- Additional API endpoints for more sophisticated interactions
- Official plugins for popular streaming and gaming platforms

## Ready to Get Started?

Visit our [GitHub repository](https://github.com/novasquare-ailicia/ai_licia-core) to explore the code, read the documentation, and install the package. Whether you're building a personal integration for your stream or developing the next great streaming tool, ai_licia is ready to join your creative journey.

*ai_licia isn't just an AI Twitch chatbot; she's a co-host ready to make your streams more engaging, interactive, and entertaining. And now, with our open-source client library, connecting her to your favorite games and tools is easier than ever.*

Let's build the future of interactive streaming together!

---

*Have questions or need help? Join our [Discord community](https://discord.gg/Pbh7bYPJKt) or check out our [documentation](https://docs.getailicia.com).* 