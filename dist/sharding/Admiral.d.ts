/// <reference types="node" />
import { EventEmitter } from "events";
import { Collection } from "../util/Collection";
import * as Eris from "eris";
interface ServiceCreator {
    name: string;
    path: string;
}
export interface StartingStatus {
    status: "online" | "idle" | "dnd" | "offline";
    game?: Eris.ActivityPartial<Eris.BotActivityType>;
}
export interface Options {
    /** Absolute path to the js file */
    path: string;
    /** Bot token */
    token: string;
    /** Guilds per shard */
    guildsPerShard?: number;
    /** Number of shards */
    shards?: number | "auto";
    /** Number of clusters */
    clusters?: number | "auto";
    /** Options to pass to the Eris client constructor */
    clientOptions?: Eris.ClientOptions;
    /** How long to wait for shards to connect to discord */
    timeout?: number;
    /** How long to wait for a service to connect */
    serviceTimeout?: number;
    /** How long between starting clusters */
    clusterTimeout?: number;
    /** Node arguments to pass to the clusters */
    nodeArgs?: string[];
    /** How often to update the stats after all clusters are spawned (set to "disable" to disable automated stats) */
    statsInterval?: number | "disable";
    /** Services to start by name and path */
    services?: ServiceCreator[];
    /** First shard ID to use on this instance of eris-fleet */
    firstShardID?: number;
    /** Last shard ID to use on this instance of eris-fleet */
    lastShardID?: number;
    /** Option to have less logging show up */
    lessLogging?: boolean;
    /** Allows for more logging customization (overrides generic lessLogging option) */
    whatToLog?: {
        /** Whitelist of what to log */
        whitelist?: string[];
        /** Blacklist of what to log */
        blacklist?: string[];
    };
    /** Amount of time to wait before doing a forced shutdown during shutdowns */
    killTimeout?: number;
    /** Whether to split the source in to an Object */
    objectLogging?: boolean;
    /** Custom starting status */
    startingStatus?: StartingStatus;
    /** Whether to use faster start */
    fasterStart?: boolean;
    /** How long to wait before giving up on a fetch */
    fetchTimeout?: number;
    /** Extended eris client class (should extend Eris.Client) */
    customClient?: typeof Eris.Client;
}
export interface ShardStats {
    latency: number;
    id: number;
    ready: boolean;
    status: "disconnected" | "connecting" | "handshaking" | "ready";
    guilds: number;
    users: number;
}
export interface ClusterStats {
    id: number;
    guilds: number;
    users: number;
    uptime: number;
    voice: number;
    largeGuilds: number;
    ram: number;
    shardStats: ShardStats[] | [];
}
export interface ServiceStats {
    name: number;
    ram: number;
}
export interface Stats {
    guilds: number;
    users: number;
    clustersRam: number;
    servicesRam: number;
    masterRam: number;
    totalRam: number;
    voice: number;
    largeGuilds: number;
    shardCount: number;
    clusters: ClusterStats[];
    services: ServiceStats[];
}
/** The sharding manager */
export declare class Admiral extends EventEmitter {
    /** Map of clusters by  to worker by ID */
    clusters: Collection;
    /** Map of services by name to worker ID */
    services: Collection;
    /** Maps of workers currently launching by ID */
    private launchingWorkers;
    private path;
    private token;
    guildsPerShard: number;
    shardCount: number | "auto";
    clusterCount: number | "auto";
    lastShardID: number;
    firstShardID: number;
    private clientOptions;
    serviceTimeout: number;
    clusterTimeout: number;
    killTimeout: number;
    private erisClient;
    private nodeArgs?;
    private statsInterval;
    stats?: Stats;
    /** Services to create */
    private servicesToCreate?;
    private queue;
    private eris;
    private prelimStats?;
    private statsWorkersCounted?;
    private chunks?;
    private pauseStats;
    private whatToLog;
    private softKills;
    private launchingManager;
    private objectLogging;
    private startingStatus?;
    private fasterStart;
    private resharding;
    private statsStarted;
    private fetches;
    private fetchTimeout;
    /**
     * Creates the sharding manager
     * @param options Options to configure the sharding manager
    */
    constructor(options: Options);
    private launch;
    /**
     * Restarts a specific cluster
     * @param clusterID ID of the cluster to restart
     * @param hard Whether to ignore the soft shutdown function
    */
    restartCluster(clusterID: number, hard: boolean): void;
    /**
     * Restarts all clusters
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllClusters(hard: boolean): void;
    /**
     * Restarts a specific service
     * @param serviceName Name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    restartService(serviceName: string, hard: boolean): void;
    /**
     * Restarts all services
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllServices(hard: boolean): void;
    /**
     * Shuts down a cluster
     * @param clusterID The ID of the cluster to shutdown
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownCluster(clusterID: number, hard: boolean): void;
    /**
     * Shuts down a cluster
     * @param serviceName The name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownService(serviceName: string, hard: boolean): void;
    /**
     * Shuts down everything and exits the master process
     * @param hard Whether to ignore the soft shutdown function
    */
    totalShutdown(hard: boolean): void;
    /** Reshard */
    reshard(): void;
    private startService;
    private startCluster;
    private calculateShards;
    private chunk;
    private shutdownWorker;
    private restartWorker;
    private fetchInfo;
    private startStats;
    broadcast(op: string, msg: unknown): void;
    error(message: any, source?: string): void;
    debug(message: any, source?: string): void;
    log(message: any, source?: string): void;
    warn(message: any, source?: string): void;
}
export {};
