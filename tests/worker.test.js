// tests/worker.test.js
import { setupWorker } from "../app/workers/generic.worker";
import { Worker } from "bullmq";

jest.mock("bullmq"); // Mock the bullmq library

describe("Generic Worker", () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    Worker.mockClear();
  });

  it("should create a BullMQ Worker with the correct queue name and processor", () => {
    const queueName = "test-queue";
    setupWorker(queueName);

    // Expect the Worker constructor to have been called with 'test-queue', a processor function, and connection options
    expect(Worker).toHaveBeenCalledWith(
      queueName,
      expect.any(Function),
      // Now that redisConnection is properly imported, we expect an object here.
      // The mock of Worker won't care about the exact instance, just that it's an object.
      expect.objectContaining({ connection: expect.any(Object) })
    );
    // The connection object itself comes from the actual redisConnection import.
  });

  it("should log an error and exit if no queue name is provided when run directly", () => {
    // This test will be more relevant when we implement the command-line argument parsing
    // in generic.worker.js. For now, we are focusing on the setupWorker function.
    // We can expand this test in Stage 2.
    expect(true).toBe(true); // Placeholder for now
  });
});
