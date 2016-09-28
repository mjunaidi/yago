import { expect } from "chai";
import { Task } from "../src/task";
import { Yago } from "../src";
import { Logger } from "../src/logger";
import { StandardLogger } from "../src/logger/standard_logger";
import { MemoryLogger } from "./helper/memory_logger";
import { InProcessTaskQueue } from "../src/inprocess_task_queue";
import { DEFAULT_RETRY_COUNT, ExecutionResult, ExecutionResultOutcome } from "../src/task_runner";
import { HelloWorldTaskRunner } from "./dummy/helloworld_task_runner";
import { ThrowErrorTaskRunner } from "./dummy/throwerror_task_runner";
import { NoNameTaskRunner } from "./dummy/noname_task_runner";
import * as request from "request";

describe("Yago", () => {
  let yago: Yago;
  let logger: MemoryLogger;

  beforeEach(() => {
    logger = new MemoryLogger();
    yago = new Yago({
      logger,
      queue: new InProcessTaskQueue(),
      interval: 5
    });
    yago.register(HelloWorldTaskRunner);
    yago.register(ThrowErrorTaskRunner);
  });

  afterEach(() => {
    yago.stop();
  });

  it("should process initialize with default values", () => {
    const defaultYago = new Yago();
    expect(defaultYago.interval).to.be.eq(500);
    expect(defaultYago.runners).to.be.empty;
    expect(defaultYago.logger).to.be.instanceof(StandardLogger);
    expect(defaultYago.queue).to.be.instanceof(InProcessTaskQueue);
  });

  it("should emit process event for both tasks", (done) => {
    yago.enqueue("hello-world");
    yago.enqueue("hello-world");

    let count = 0;
    yago.on("process", (task: Task) => {
      count++;
      if (count === 2) {
        done();
      }
    });

    yago.start();
  });

  it("should emit processed event", (done) => {
    yago.enqueue("hello-world");

    let count = 0;
    yago.on("processed", (task: Task, result: ExecutionResult) => {
      expect(result.outcome).to.be.eq(ExecutionResultOutcome.Success);
      done();
    });

    yago.start();
  });

  it("should retry more times based on TaskRunner retry count", (done) => {
    yago.enqueue("throw-error");

    let count = 0;
    yago.on("errored", (task: Task, err: any) => {
      expect(err).to.deep.equal(new Error("Something happened..."));
      if (++count === DEFAULT_RETRY_COUNT)
        done();
    });

    yago.start();
  });

  it("should enqueue new task every second", (done) => {
    yago.enqueue("hello-world");
    yago.schedule("* * * * * *", "hello-world");

    yago.on("enqueued", (task: Task) => {
      expect(task.name).to.be.eq("hello-world");
      done();
    });

    yago.start();
  });

  it("should emit ignored event for unknown task", (done) => {
    yago.enqueue("send-email");

    let count = 0;
    yago.on("ignored", (task: Task) => {
      expect(task.name).to.be.eq("send-email");
      done();
    });

    yago.start();
  });

  it("should process task with payload", (done) => {
    yago.enqueue("hello-world", { payload: "Yago" });

    logger.on("data", (data: string) => {
      expect(data).to.be.eq("Hello World: Yago");
      done();
    });

    yago.start();
  });

  it("should throw error when registering unnamed TaskRunners", () => {
    expect(yago.register.bind(yago, NoNameTaskRunner)).to.throw(Error, "NoNameTaskRunner does not have a RunTask decoration.");
  });

  it("should queue task when using HTTP API", (done) => {
    yago.start();
    yago.on("enqueued", (task: Task) => {
      expect(task.name).to.be.eq("hello-world-via-api");
      done();
    });

    const data = { name: "hello-world-via-api" };
    request.post("http://localhost:8888/api/enqueue", { json: data });
  });
});
