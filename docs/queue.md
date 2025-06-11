# Queue Based Worker Pattern

This document describes the queue design used between the WhatsApp gateway and the Beacon workers. The same pattern can be reused in any application that needs workers to process events asynchronously.

## Overview

1. **Producers** place jobs onto a Redis backed queue using [BullMQ](https://docs.bullmq.io/).
2. **Workers** listen to the queue and perform work on each job.
3. Results (or follow up jobs) can be placed on another queue for downstream workers.

In Beacon the WhatsApp gateway converts incoming messages and posts them to an *input* queue (`bm_in`). A worker consumes from this queue, performs processing, then posts a reply to an *output* queue (`bm_out`). The gateway has a separate worker that watches `bm_out` and sends messages back to WhatsApp users.

The following sections show the main building blocks of this pattern in an abstract form.

## Queue Utilities

A small utility module creates and caches BullMQ queue instances. This keeps queue creation consistent and avoids duplicating connection logic.

```javascript
// queueUtils.js
import { Queue } from "bullmq";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

const queues = {};

export function getQueue(name) {
  if (!queues[name]) {
    queues[name] = new Queue(name, { connection: redis });
  }
  return queues[name];
}

export async function addMessageToQueue(name, payload, jobName = "process") {
  const queue = getQueue(name);
  const jobId = payload.id || `${name}-${Date.now()}`;
  await queue.add(jobName, payload, {
    jobId,
    removeOnComplete: true,
    removeOnFail: 1000,
  });
  return { jobId };
}
```

## Creating a Queue

Queues are identified purely by name. Calling `getQueue("my_queue")` will create the
queue on first use if it does not already exist:

```javascript
import { getQueue } from "../utils/queueUtils.js";

const paymentQueue = getQueue("payment_tasks");
// paymentQueue can now be used to add or process jobs
```

BullMQ persists the queue metadata in Redis automatically, so no additional setup
is needed beyond choosing a unique name.

## Enqueuing Messages

Producers (for example the WhatsApp gateway or API controllers) call `addMessageToQueue` with a queue name and payload. Below is a simplified controller that exposes an HTTP endpoint for adding jobs:

```javascript
// queue.controller.js
import { addMessageToQueue } from "../utils/queueUtils.js";

export async function addMessage(req, res) {
  const { queueName } = req.params;
  const payload = req.body;
  const result = await addMessageToQueue(queueName, payload, "addMessage");
  res.status(201).json({ jobId: result.jobId });
}
```

Clients send a POST request to `/api/queue/add/<queueName>` with a JSON body. The message is stored in Redis until a worker processes it.

## Worker Process

Workers subscribe to a queue and handle jobs one by one. A worker might generate a response and enqueue it on another queue.

```javascript
// example.worker.js
import { Worker } from "bullmq";
import { addMessageToQueue } from "../utils/queueUtils.js";

const inbound = "bm_in";
const outbound = "bm_out";

const worker = new Worker(inbound, async (job) => {
  // Perform business logic with job.data
  const resultMessage = {
    chatID: job.data.chatID,
    message: `Echo: ${job.data.message}`,
  };
  // Place the result on the outbound queue
  await addMessageToQueue(outbound, resultMessage, "sendMessage");
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});
```

## Multi-Step Pipelines

For complex jobs you may want to break processing into reusable "pipelines" that
live outside the worker. A pipeline module encapsulates a series of service
calls and returns the final result to the worker:

```javascript
// app/pipelines/registerUser.js
export default async function registerUserPipeline(data) {
  const account = await createAccount(data);
  const profile = await createProfile(account, data);
  await sendWelcomeEmail(profile.email);
  return { chatID: data.chatID, message: "Registration complete" };
}
```

Pipelines can be placed in a folder such as `app/pipelines/` to keep them
organized.

## Selecting a Pipeline

A worker can dispatch to a specific pipeline based on details in the job. Using
a simple `switch` statement keeps the worker logic thin:

```javascript
// example.worker.js (excerpt)
import registerUser from "../pipelines/registerUser.js";
import recoverAccount from "../pipelines/recoverAccount.js";

const worker = new Worker(inbound, async (job) => {
  let result;
  switch (job.data.type) {
    case "register":
      result = await registerUser(job.data);
      break;
    case "recover":
      result = await recoverAccount(job.data);
      break;
    default:
      throw new Error(`Unknown job type: ${job.data.type}`);
  }
  await addMessageToQueue(outbound, result, "sendMessage");
});
```

## Gateway Outbound Worker

The gateway runs a dedicated worker that consumes the outbound queue and sends each message to the external service (WhatsApp in Beacon). This keeps external API interactions isolated from core processing logic.

```javascript
// outboundGateway.worker.js
import { Worker } from "bullmq";
import { sendToWhatsApp } from "./gateway.js";

new Worker("bm_out", async (job) => {
  await sendToWhatsApp(job.data);
});
```

## Summary

1. **Producers** add events/jobs to a named queue using `addMessageToQueue`.
2. **Workers** listen on that queue using `new Worker(queueName, processor)`.
3. **Results** or follow up actions are optionally pushed to another queue.

This pattern cleanly decouples message ingestion from processing and external integrations. Because BullMQ queues are backed by Redis, multiple worker processes can scale horizontally while sharing the same job stream.

Reuse these snippets as a starting point for any system that requires asynchronous processing via queues.
