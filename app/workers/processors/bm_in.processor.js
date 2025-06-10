// app/workers/processors/bm_in.processor.js
import { FlowProducer } from "bullmq";
import redisConnection from "../../libs/redis.js";
import { validateBeaconMessage } from "../../app/libs/validators.js";
import { getConversation } from "../../app/api/services/conversation.service.js";

const flow = new FlowProducer({ connection: redisConnection });

export default async function processInbound(job) {
  const { beaconMessage } = job.data;

  /* 1️⃣ validate & normalise --------------------------------------- */
  const validation = validateBeaconMessage(beaconMessage);
  if (!validation.ok) throw new Error(validation.msg);

  /* 2️⃣ business logic --------------------------------------------- */
  const convo = await getConversation(beaconMessage.conversationID);
  // …your per-business rules here (LLM call, rules engine, etc.) …

  /* 3️⃣ enqueue follow-up job -------------------------------------- */
  await flow.add({
    name: "respond-to-user",
    queueName: "bm_out",
    data: { conversationID: convo.id, lastUserMsg: beaconMessage },
    opts: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      timeout: 120_000,
    },
  });

  /* 4️⃣ return meta for dashboards --------------------------------- */
  return { status: "queued-reply", convoID: convo.id };
}
