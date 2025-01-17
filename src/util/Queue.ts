import {EventEmitter} from "events";
import {ClientOptions} from "eris";
import * as Admiral from "../sharding/Admiral";

interface ClusterConnectMessage {
	clusterID: number;
	clusterCount: number;
	op: "connect" | string;
	firstShardID: number;
	lastShardID: number;
	shardCount: number;
	token: string;
	clientOptions: ClientOptions;
	path: string;
	whatToLog: string[];
	startingStatus?: Admiral.StartingStatus;
}

interface ShutdownMessage {
	op: "shutdown" | string;
}

interface ServiceConnectMessage {
	serviceName: string;
	path: string;
	op: "connect" | string;
	timeout: number;
	whatToLog: string[];
}

export interface QueueItem {
	type: "service" | "cluster" | string;
	workerID: number;
	message: ClusterConnectMessage | ServiceConnectMessage | ShutdownMessage;
}

export class Queue extends EventEmitter {
	/** The queue */
	public queue: QueueItem[];
	/** Pauses all non-authorized executions */
	public override: string | undefined;

	public constructor() {
		super();
		this.queue = [];
	}

	public execute(first?: boolean, override?: string): void {
		if (this.override && override !== this.override) return;
		if (!first) this.queue.splice(0, 1);
		const item = this.queue[0];
		if (!item) return;
		this.emit("execute", item);
	}

	public item(item: QueueItem, override?: string): void {
		if (this.override && override !== this.override) return;
		this.queue.push(item);
		if (this.queue.length == 1) this.execute(true, override);
	}
}