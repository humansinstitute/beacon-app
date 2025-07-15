# Beacon: A protocol to provide a gateway to freedom tech

![beacon-image](https://github.com/user-attachments/assets/fbad331a-acd5-4e6e-8483-5c1f4c13e24d)

> On the island of Pharos the Ptolemies lit a beacon that turned Alexandria into the nerve-centre of the ancient world, guiding mariners safely into the port of liberty, knowledge and freedom.
>
> The goal of the project is to relight that flame on the internet, building a trojan horse inside the most ubiquitous chat networks in the world to guide people towards free information, free networks and freedom money.
>
> Wherever a handset can send a text, The Beacon can deliver knowledge, coordination, and untraceable Satoshis.
>
> The tower is gone; but the light will remain.

Beacon is intended to be an open protocol to allow communities to offer access to freedom tech, with no on device install and minimal barrier to entry sign up in applications people already use.

A trojan horse for freedom tech.

## Features

### 🪙 Bitcoin/Cashu Integration

- **Balance Checking**: Check your Bitcoin wallet balance through simple messages
- **Lightning Payments**: Pay Lightning invoices using natural language commands
- **Invoice Generation**: Create payment requests to receive Bitcoin
- **Token Transfers**: Send Bitcoin to other users via WhatsApp
- **Automatic Wallet Creation**: Seamless onboarding with Cashu eCash technology

### 💬 Conversational AI

- **Natural Language Processing**: Understand and respond to complex queries
- **Context Awareness**: Maintain conversation history and context
- **Multi-Intent Support**: Handle both Bitcoin operations and general conversations
- **Intelligent Routing**: Automatically route requests to appropriate handlers

### 🔗 Gateway Integration

- **WhatsApp Gateway**: Full WhatsApp messaging integration
- **Signal Gateway**: Planned Signal messaging support
- **Nostr Integration**: Built on Nostr protocol for decentralized identity

## Beacon App

Is the open source code behind a reference implementation for beacon. It will provide both WhatsApp and Signal gateways to access your Nostr based Beacon account.

- **Beacon-App**: Defines the agent framework to manage your requests and deliver specific user flows for different pre-defined experiences inside the app
- **Beacon-signer**: A remote signing server which can either be self hosted on a laptop and provides signing of Beacon activities coordinated via NostrMQ and gateways
- **Cashu Integration**: Bitcoin wallet functionality through Cashu eCash tokens with Lightning Network support

## Quick Start

### For Users

1. **Start a conversation** with your Beacon WhatsApp number
2. **Check your balance**: Send "check my bitcoin balance"
3. **Receive Bitcoin**: Send "create invoice for 1000 sats"
4. **Send Bitcoin**: Send "send 500 sats to alice"
5. **Pay invoices**: Send "pay lnbc..." with any Lightning invoice

### For Developers

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-org/thebeacon.git
   cd thebeacon
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure environment**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start services**:
   ```bash
   pm2 start ecosystem.config.cjs
   ```

## Documentation

- **[Implementation Guide](docs/cashu_integration_implementation.md)**: Complete technical implementation details
- **[Deployment Guide](docs/cashu_deployment_guide.md)**: Production deployment instructions
- **[User Guide](docs/cashu_user_guide.md)**: End-user documentation for Bitcoin features
- **[API Reference](docs/cashu_api_reference.md)**: Developer API documentation
- **[Architecture Overview](docs/architecture.md)**: System architecture and design patterns

### Purpose

The purpose of beacon is not to be "the wallet to end them all" it is to provide a pragmatic entry point to freedom tech.

It was born out of an initial frustration of trying to deliver sophisticated apps in places where the regular user couldn't afford internet, the internet was bad when they did have it, smartphones barely existed and the only single thing that ever worked reliably was WhatsApp.

Turns out Zuckerberg already pays for subsidized access to a limited, controlled pastiche of the internet.

But in the world of AI the humble text box is more or less all you need to orchestrate any functionality you could desire.

So let's meet the people where they are, give them access to all the information and services on the internet and make freedom tech accessible to all.

![freedom_tech_meme](https://github.com/user-attachments/assets/622123cc-86e0-4365-9bbf-73d2ffe56685)
