import { TaskQueue } from "./TaskQueue";

export class InProcessTaskQueue extends TaskQueue {
  count(): number {
    return 0;
  }
}