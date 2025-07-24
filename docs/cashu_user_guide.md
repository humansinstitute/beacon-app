# Cashu Feature User Guide

## Overview

The Cashu feature enables you to manage Bitcoin through simple WhatsApp messages. You can check your balance, pay Lightning invoices, create payment requests, and send Bitcoin to others using natural language commands. No app installation required - everything works through WhatsApp!

## Getting Started

### Prerequisites

1. **WhatsApp Account**: You need an active WhatsApp account
2. **Beacon Registration**: You must be registered with the Beacon system
3. **Internet Connection**: Required for Bitcoin operations

### First Time Setup

When you first use a Bitcoin command, the system automatically creates a Cashu wallet for you. No additional setup required!

**Example First Message**:

```
check my bitcoin balance
```

**System Response**:

```
💰 Your wallet balance is 0 sats

Your Cashu wallet has been created and is ready to use!
```

## Available Commands

### 1. Check Balance

Check how much Bitcoin you have in your wallet.

**Command Examples**:

- `check my bitcoin balance`
- `how much bitcoin do I have`
- `wallet balance`
- `show my balance`
- `what's my bitcoin balance?`

**Response Example**:

```
💰 Your wallet balance is 5,000 sats
```

### 2. Pay Lightning Invoice

Pay a Lightning Network invoice using your wallet balance.

**Command Examples**:

- `pay lnbc1000n1p3xnhl2pp5...`
- `pay this invoice lnbc1000n1p3xnhl2pp5...`
- `send payment lnbc1000n1p3xnhl2pp5...`

**Response Example**:

```
✅ Payment sent! Paid 1,000 sats. Fee: 2 sats
```

**Error Examples**:

```
❌ That doesn't look like a valid Lightning invoice. Lightning invoices start with 'lnbc'.

❌ Insufficient balance. You have 500 sats, but need 1,000 sats.
```

### 3. Generate Invoice

Create a Lightning invoice to receive Bitcoin payments.

**Command Examples**:

- `create invoice for 5000 sats`
- `generate invoice for 2000 sats`
- `request payment for 1000 sats`
- `invoice for 500 satoshis`
- `need invoice for 10000 sats`

**Response Example**:

```
📄 Here's your invoice for 5,000 sats:

lnbc50u1p3xnhl2pp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq8rkx3yf5tcsyz3d73gafnh3cax9rn449d9p5uxz9ezhhypd0elx87sjle52x86fux2ypatgddc6k63n7erqz25le42c4u4ecky03ylcqca784w

Share this with someone to receive payment.
```

### 4. Send Tokens

Send Cashu tokens to another user.

**Command Examples**:

- `send 1000 sats to alice`
- `transfer 500 sats to bob`
- `give 2000 satoshis to charlie`

**Response Example**:

```
✅ Sent 1,000 sats successfully to alice
```

**Error Examples**:

```
❌ Please specify an amount to send (e.g., '1000 sats').

❌ Please specify who you want to send tokens to.

❌ Insufficient balance. You have 500 sats, but need 1,000 sats.
```

## Natural Language Support

The system understands various ways of expressing the same command:

### Amount Formats

- `1000 sats`
- `1000 satoshis`
- `1000 bitcoin`
- `1000 btc`
- `five thousand sats`
- `2k sats`

### Balance Check Variations

- `check my bitcoin balance`
- `how much bitcoin do I have`
- `what's my wallet balance`
- `show balance`
- `bitcoin balance check`

### Payment Variations

- `pay this invoice`
- `send payment`
- `pay lnbc...`
- `make payment`

### Invoice Generation Variations

- `create invoice`
- `generate payment request`
- `make invoice`
- `request payment`
- `need invoice`

## Response Formats

### Success Responses

All successful operations include clear confirmation messages with relevant details:

- **Balance**: Shows current amount with emoji
- **Payments**: Confirms amount paid and fees
- **Invoices**: Provides shareable invoice string
- **Transfers**: Confirms successful transfer

### Error Responses

Error messages are designed to be helpful and actionable:

- **Service Issues**: Clear explanation when services are down
- **Invalid Input**: Guidance on correct format
- **Insufficient Funds**: Shows current balance vs. required amount
- **Network Issues**: Suggests retry or alternative actions

## Common Use Cases

### 1. Receiving Your First Bitcoin

1. Ask someone to send you Bitcoin
2. Generate an invoice: `create invoice for 1000 sats`
3. Share the invoice with the sender
4. Check your balance: `check my balance`

### 2. Paying for Something

1. Get a Lightning invoice from the merchant
2. Pay the invoice: `pay lnbc...`
3. Receive confirmation of payment

### 3. Sending Bitcoin to a Friend

1. Check your balance: `check my balance`
2. Send tokens: `send 500 sats to friend`
3. Receive confirmation

### 4. Regular Balance Monitoring

Simply message: `balance` or `how much bitcoin do I have?`

## Error Messages and Troubleshooting

### Common Error Messages

#### Service Unavailable

```
❌ I'm sorry, Cashu services are currently down. Please try again later.
```

**Solution**: Wait a few minutes and try again. If the problem persists, contact support.

#### Invalid Invoice

```
❌ That doesn't look like a valid Lightning invoice. Lightning invoices start with 'lnbc'.
```

**Solution**: Check that you copied the complete invoice string starting with "lnbc".

#### Insufficient Balance

```
❌ Insufficient balance. You have 500 sats, but need 1,000 sats.
```

**Solution**: Add more funds to your wallet or reduce the amount.

#### Request Timeout

```
❌ The request timed out. Please try again.
```

**Solution**: Try the command again. If it continues to fail, there may be network issues.

#### Unclear Request

```
I understand you want to do something with Bitcoin/Cashu, but I'm not sure what exactly. You can:

• Check balance: 'check my balance'
• Pay invoice: 'pay [invoice]'
• Create invoice: 'create invoice for [amount] sats'
• Send tokens: 'send [amount] sats to [recipient]'
```

**Solution**: Use one of the suggested command formats.

### Troubleshooting Tips

1. **Be Specific**: Use clear commands like "check my balance" rather than just "bitcoin"
2. **Include Units**: Always specify "sats" or "satoshis" for amounts
3. **Complete Invoices**: Copy the entire Lightning invoice string
4. **Wait for Responses**: Allow time for operations to complete
5. **Check Spelling**: Ensure recipient names are spelled correctly

## Security and Privacy

### What We Store

- Your Nostr public key (npub) for wallet identification
- Transaction history for your wallet
- Conversation context for better assistance

### What We Don't Store

- Your private keys (you maintain control)
- WhatsApp message content beyond processing
- Personal information beyond what's necessary

### Security Best Practices

1. **Keep Amounts Reasonable**: Don't store large amounts in hot wallets
2. **Verify Recipients**: Double-check recipient names before sending
3. **Monitor Your Balance**: Regularly check your wallet balance
4. **Report Issues**: Contact support if you notice unauthorized transactions

## Limits and Restrictions

### Transaction Limits

- **Minimum Amount**: 1 sat
- **Maximum Amount**: 1,000,000 sats (configurable)
- **Daily Limits**: May apply based on configuration

### Service Limitations

- **Network Dependency**: Requires internet connection
- **Service Availability**: Dependent on Lightning Network and mint availability
- **Processing Time**: Operations may take a few seconds to complete

## Advanced Features

### Multiple Mints

The system uses a default Cashu mint but may support multiple mints in the future.

### Transaction History

Currently, you can check your current balance. Transaction history features may be added in future updates.

### Recurring Payments

Not currently supported but planned for future releases.

## Getting Help

### In-Chat Help

If you're unsure about a command, just ask:

- `help with bitcoin`
- `how do I check my balance?`
- `what bitcoin commands are available?`

### Support Channels

For technical issues or questions:

1. Check this user guide
2. Review error messages for guidance
3. Contact system administrators
4. Report bugs through appropriate channels

## Frequently Asked Questions

### Q: Is my Bitcoin safe?

A: Your Bitcoin is secured using Cashu eCash technology. The system doesn't store your private keys, and you maintain control over your funds.

### Q: What happens if I lose my phone?

A: Your wallet is tied to your Nostr identity. As long as you have access to your Nostr keys, you can recover access to your wallet.

### Q: Can I use this with other Bitcoin wallets?

A: The Cashu wallet is separate from other Bitcoin wallets, but you can send and receive Bitcoin to/from any Lightning-compatible wallet.

### Q: Are there fees for transactions?

A: Lightning Network fees apply for payments. These are typically very small (1-2 sats). Cashu token transfers may have minimal fees.

### Q: How fast are transactions?

A: Lightning payments are typically instant. Cashu token operations are also very fast, usually completing within seconds.

### Q: What if the service is down?

A: Your funds remain safe even if the service is temporarily unavailable. You can access your wallet once the service is restored.

### Q: Can I send Bitcoin to someone without WhatsApp?

A: Yes, you can generate a Lightning invoice that anyone with a Lightning wallet can pay, regardless of whether they use WhatsApp.

## Tips for Best Experience

1. **Use Clear Commands**: Be specific about what you want to do
2. **Include Amounts**: Always specify amounts with units (sats)
3. **Double-Check Invoices**: Verify Lightning invoices before paying
4. **Monitor Balance**: Regularly check your balance
5. **Start Small**: Begin with small amounts to get familiar with the system
6. **Be Patient**: Allow time for operations to complete
7. **Ask for Help**: Don't hesitate to ask if you're unsure about something

## Example Conversation

Here's a typical conversation flow:

**User**: `check my bitcoin balance`
**Beacon**: `💰 Your wallet balance is 0 sats`

**User**: `create invoice for 1000 sats`
**Beacon**: `📄 Here's your invoice for 1,000 sats: lnbc10u1p3xnhl2pp5...`

_[After someone pays the invoice]_

**User**: `check balance`
**Beacon**: `💰 Your wallet balance is 1,000 sats`

**User**: `send 500 sats to alice`
**Beacon**: `✅ Sent 500 sats successfully to alice`

**User**: `balance`
**Beacon**: `💰 Your wallet balance is 500 sats`

This user guide provides everything you need to start using Bitcoin through WhatsApp with the Cashu feature. Start with small amounts and simple commands to get comfortable with the system!
