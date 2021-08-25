"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Admiral = void 0;
const events_1 = require("events");
const os_1 = require("os");
const master = __importStar(require("cluster"));
const cluster_1 = require("cluster");
const Collection_1 = require("../util/Collection");
const Queue_1 = require("../util/Queue");
const Eris = __importStar(require("eris"));
const Cluster_1 = require("../clusters/Cluster");
const Service_1 = require("../services/Service");
const path = __importStar(require("path"));
const util_1 = require("util");
const ErrorHandler_1 = require("../util/ErrorHandler");
/**
 * The sharding manager.
 * @example
 * ```js
 * const { isMaster } = require('cluster');
 * const { Fleet } = require('eris-fleet');
 * const path = require('path');
 * const { inspect } = require('util');
 * require('dotenv').config();
 *
 * const options = {
 * 	path: path.join(__dirname, "./bot.js"),
 * 	token: process.env.token
 * }
 *
 * const Admiral = new Fleet(options);
 *
 * if (isMaster) {
 * 	// Code to only run for your master process
 * 	Admiral.on('log', m => console.log(m));
 * 	Admiral.on('debug', m => console.debug(m));
 * 	Admiral.on('warn', m => console.warn(m));
 * 	Admiral.on('error', m => console.error(inspect(m)));
 *
 * 	// Logs stats when they arrive
 * 	Admiral.on('stats', m => console.log(m));
 * }
 * ```
 *
 * @fires Admiral#log Message to log. Supplies either a message or an {@link ObjectLog}.
 * @fires Admiral#debug Debug message to log. Supplies either a message or an {@link ObjectLog}.
 * @fires Admiral#warn Warning message to log. Supplies either a message or an {@link ObjectLog}.
 * @fires Admiral#error Error to log. Supplies either a message or an {@link ObjectLog}.
 * @fires Admiral#clusterReady Fires when a cluster is ready. Supplies {@link ClusterCollection | Cluster Object}.
 * @fires Admiral#serviceReady Fires when a service is ready. Supplies {@link ServiceCollection | Service Object}.
 * @fires Admiral#ready Fires when the queue is empty.
 * @fires Admiral#stats Fires when stats are ready. Supplies {@link Stats}
*/
class Admiral extends events_1.EventEmitter {
    /**
     * Creates the sharding manager
     * @param options Options to configure the sharding manager
    */
    constructor(options) {
        super();
        this.objectLogging = options.objectLogging || false;
        this.path = options.path;
        this.token = options.token.startsWith("Bot ") ? options.token : `Bot ${options.token}`;
        this.guildsPerShard = options.guildsPerShard || 1300;
        this.shardCount = options.shards || "auto";
        this.clusterCount = options.clusters || "auto";
        this.clientOptions = options.clientOptions || {};
        this.clusterTimeout = options.clusterTimeout || 5e3;
        this.serviceTimeout = options.serviceTimeout || 0;
        this.killTimeout = options.killTimeout || 10e3;
        this.erisClient = options.customClient || Eris.Client;
        this.useCentralRequestHandler = options.useCentralRequestHandler || false;
        this.nodeArgs = options.nodeArgs;
        this.statsInterval = options.statsInterval || 60e3;
        this.firstShardID = options.firstShardID || 0;
        this.lastShardID = options.lastShardID || 0;
        this.fetchTimeout = options.fetchTimeout || 10e3;
        this.loadClusterCodeImmediately = options.loadCodeImmediately || false;
        this.overrideConsole = options.overrideConsole || true;
        this.startServicesTogether = options.startServicesTogether || false;
        this.maxConcurrencyOverride = options.maxConcurrencyOverride;
        this.maxConcurrency = this.maxConcurrencyOverride || 1;
        this.shutdownTogether = options.shutdownTogether || false;
        this.resharding = false;
        this.statsStarted = false;
        if (options.startingStatus)
            this.startingStatus = options.startingStatus;
        // Deals with needed components
        if (!options.token)
            throw "No token!";
        if (!path.isAbsolute(options.path))
            throw "The path needs to be absolute!";
        if (options.services) {
            options.services.forEach((e) => {
                if (!path.isAbsolute(e.path)) {
                    throw `Path for service ${e.name} needs to be absolute!`;
                }
                if (options.services.filter((s) => s.name == e.name).length > 1) {
                    throw `Duplicate service names for service ${e.name}!`;
                }
            });
        }
        if (options.timeout)
            this.clientOptions.connectionTimeout = options.timeout;
        const allLogOptions = [
            "gateway_shards",
            "admiral_start",
            "shards_spread",
            "stats_update",
            "all_clusters_launched",
            "all_services_launched",
            "cluster_launch",
            "service_launch",
            "cluster_start",
            "service_start",
            "service_ready",
            "cluster_ready",
            "code_loaded",
            "shard_connect",
            "shard_ready",
            "shard_disconnect",
            "shard_resume",
            "service_restart",
            "cluster_restart",
            "service_shutdown",
            "cluster_shutdown",
            "total_shutdown",
            "resharding_transition_complete",
            "resharding_transition",
            "resharding_worker_killed",
            "concurrency_group_starting"
        ];
        this.whatToLog = allLogOptions;
        if (options.lessLogging) {
            this.whatToLog = [
                "gateway_shards",
                "admiral_start",
                "shard_disconnect",
                "shard_resume",
                "cluster_ready",
                "service_ready",
                "cluster_start",
                "service_start",
                "all_services_launched",
                "all_clusters_launched",
                "total_shutdown",
                "cluster_shutdown",
                "service_shutdown",
                "resharding_transition_complete",
                "concurrency_group_starting"
            ];
        }
        if (options.whatToLog) {
            if (options.whatToLog.blacklist) {
                options.whatToLog.blacklist.forEach((t) => {
                    if (this.whatToLog.includes(t)) {
                        this.whatToLog.splice(this.whatToLog.indexOf(t), 1);
                    }
                });
            }
            else if (options.whatToLog.whitelist) {
                this.whatToLog = options.whatToLog.whitelist;
            }
        }
        if (options.services)
            this.servicesToCreate = options.services;
        this.services = new Collection_1.Collection();
        this.clusters = new Collection_1.Collection();
        this.launchingWorkers = new Collection_1.Collection();
        this.queue = new Queue_1.Queue();
        this.softKills = new Map();
        this.fetches = new Map();
        this.launchingManager = new Map();
        this.connectedClusterGroups = new Map();
        if (this.statsInterval !== "disable") {
            this.stats = {
                guilds: 0,
                users: 0,
                members: 0,
                clustersRam: 0,
                servicesRam: 0,
                masterRam: 0,
                totalRam: 0,
                voice: 0,
                largeGuilds: 0,
                shardCount: 0,
                clusters: [],
                services: [],
                timestamp: new Date().getTime()
            };
        }
        if (this.clusterCount === "auto")
            this.clusterCount = os_1.cpus().length;
        this.eris = new this.erisClient(this.token);
        this.launch();
        if (master.isMaster) {
            cluster_1.on("message", (worker, message) => {
                var _a, _b;
                if (message.op) {
                    switch (message.op) {
                        case "log": {
                            this.ipcLog("log", message, worker);
                            break;
                        }
                        case "debug": {
                            this.ipcLog("debug", message, worker);
                            break;
                        }
                        case "error": {
                            this.ipcLog("error", message, worker);
                            break;
                        }
                        case "warn": {
                            this.ipcLog("warn", message, worker);
                            break;
                        }
                        case "launched": {
                            const lr = this.launchingManager.get(worker.id);
                            if (lr) {
                                if (lr !== "launched")
                                    lr.waiting();
                                this.launchingManager.delete(worker.id);
                            }
                            else {
                                this.launchingManager.set(worker.id, "launched");
                            }
                            break;
                        }
                        case "connected": {
                            const launchedWorker = this.launchingWorkers.get(worker.id);
                            if (launchedWorker) {
                                if (launchedWorker.cluster) {
                                    // don't change cluster map if it hasn't restarted yet
                                    if (!this.softKills.get(worker.id)) {
                                        this.clusters.set(launchedWorker.cluster.clusterID, {
                                            workerID: worker.id,
                                            clusterID: launchedWorker.cluster.clusterID,
                                            firstShardID: launchedWorker.cluster.firstShardID,
                                            lastShardID: launchedWorker.cluster.lastShardID,
                                        });
                                    }
                                    this.fetches.forEach((fetch) => {
                                        process.nextTick(() => worker.send(fetch));
                                    });
                                    // Emit a cluster is ready
                                    this.emit("clusterReady", launchedWorker.cluster);
                                }
                                else if (launchedWorker.service) {
                                    if (!this.softKills.get(worker.id)) {
                                        this.services.set(launchedWorker.service.serviceName, {
                                            workerID: worker.id,
                                            serviceName: launchedWorker.service.serviceName,
                                            path: launchedWorker.service.path,
                                        });
                                    }
                                    // Emit a service is ready
                                    this.emit("serviceReady", launchedWorker.service);
                                }
                            }
                            this.launchingWorkers.delete(worker.id);
                            if (!this.resharding && !this.softKills.get(worker.id)) {
                                worker.send({ op: "loadCode" });
                            }
                            if (this.softKills.get(worker.id)) {
                                (_a = this.softKills.get(worker.id)) === null || _a === void 0 ? void 0 : _a.fn();
                            }
                            if (this.queue.queue[1]) {
                                if (this.queue.queue[1].type == "cluster" && this.queue.queue[0].type == "cluster") {
                                    const clusterToGroupMap = this.chunkConcurrencyGroups();
                                    const clusterGroupID = clusterToGroupMap.get(launchedWorker.cluster.clusterID);
                                    if (!clusterGroupID && clusterGroupID !== 0) {
                                        this.error("Error in starting cluster: invalid cluster group ID");
                                        return;
                                    }
                                    const groupConnectedTotal = (this.connectedClusterGroups.get(clusterGroupID) || 0) + 1;
                                    this.connectedClusterGroups.set(clusterGroupID, groupConnectedTotal);
                                    const groupConnectedMax = Object.entries(clusterToGroupMap).filter(([clusterID, groupID]) => groupID === clusterGroupID).length;
                                    if (groupConnectedTotal >= groupConnectedMax) {
                                        if (this.whatToLog.includes("concurrency_group_starting") && this.maxConcurrency > 1)
                                            this.log(`Starting concurrency cluster group ${clusterGroupID + 1}`, "Admiral");
                                        setTimeout(() => this.queue.execute(), this.clusterTimeout);
                                    }
                                    //setTimeout(() => this.queue.execute(), this.clusterTimeout);
                                }
                                else if (this.startServicesTogether && this.queue.queue[1].type == "cluster" && this.queue.queue[0].type == "service") {
                                    // check concurrency for services
                                    if (this.servicesToCreate) {
                                        if (this.services.size >= this.servicesToCreate.length) {
                                            this.queue.execute();
                                        }
                                    }
                                }
                                else {
                                    this.queue.execute();
                                }
                            }
                            else {
                                this.queue.execute();
                                this.emit("ready");
                                // clear the connected groups values
                                this.connectedClusterGroups.clear();
                                // After all clusters and services are ready
                                if (this.stats && this.pauseStats) {
                                    if (!this.resharding) {
                                        if (!this.statsStarted)
                                            this.startStats();
                                    }
                                    else {
                                        this.pauseStats = false;
                                    }
                                }
                            }
                            break;
                        }
                        case "shutdown": {
                            const workerID = this.queue.queue[0].workerID;
                            if (this.softKills.get(workerID)) {
                                (_b = this.softKills.get(workerID)) === null || _b === void 0 ? void 0 : _b.fn();
                            }
                            // if (!this.queue.queue[1]) this.emit("ready");
                            break;
                        }
                        case "fetchGuild":
                        case "fetchMember":
                        case "fetchChannel":
                        case "fetchUser": {
                            this.fetchInfo(message.op, message.id, worker.id);
                            break;
                        }
                        case "serviceCommand": {
                            const service = this.services.get(message.command.service);
                            if (service) {
                                const serviceWorker = master.workers[service.workerID];
                                if (serviceWorker) {
                                    serviceWorker.send({
                                        op: "command",
                                        command: message.command,
                                        UUID: worker.id,
                                    });
                                }
                                else {
                                    worker.send({
                                        op: "return",
                                        id: message.command.UUID,
                                        value: {
                                            value: {
                                                err: `Service ${message.command.service} is unavailable.`,
                                                serviceName: service.serviceName
                                            },
                                        },
                                    });
                                    this.error(`A service I requested (${message.command.service}) is unavailable.`, `Cluster ${this.clusters.find((c) => c.workerID == worker.id).clusterID}`);
                                }
                            }
                            else {
                                worker.send({
                                    op: "return",
                                    id: message.command.UUID,
                                    value: {
                                        value: {
                                            err: `Service ${message.command.service} does not exist.`,
                                            serviceName: service.serviceName
                                        },
                                    },
                                });
                                this.error(`A service I requested (${message.command.service}) does not exist.`, `Cluster ${this.clusters.find((c) => c.workerID == worker.id).clusterID}`);
                            }
                            break;
                        }
                        case "clusterCommand": {
                            const cluster = this.clusters.get(message.command.clusterID);
                            if (cluster) {
                                const clusterWorker = master.workers[cluster.workerID];
                                if (clusterWorker) {
                                    clusterWorker.send({
                                        op: "command",
                                        command: message.command,
                                        UUID: worker.id,
                                    });
                                }
                                else {
                                    worker.send({
                                        op: "return",
                                        id: message.command.UUID,
                                        value: {
                                            value: {
                                                err: `Cluster ${message.command.clusterID} is unavailable.`,
                                                clusterID: cluster.clusterID
                                            },
                                        },
                                    });
                                    this.error(`The cluster I requested (${message.command.clusterID}) is unavailable.`, `Worker ${worker.id}`);
                                }
                            }
                            else {
                                worker.send({
                                    op: "return",
                                    id: message.command.UUID,
                                    value: {
                                        value: {
                                            err: `Cluster ${message.command.clusterID} does not exist.`,
                                            clusterID: cluster.clusterID
                                        },
                                    },
                                });
                                this.error(`The cluster I requested (${message.command.clusterID}) does not exist.`, `Worker ${worker.id}`);
                            }
                            break;
                        }
                        case "allClustersCommand": {
                            this.clusters.forEach((c) => {
                                const clusterWorker = master.workers[c.workerID];
                                if (clusterWorker) {
                                    process.nextTick(() => clusterWorker.send({
                                        op: "command",
                                        command: message.command,
                                        UUID: worker.id
                                    }));
                                }
                                else {
                                    worker.send({
                                        op: "return",
                                        id: message.command.UUID,
                                        value: {
                                            value: {
                                                err: `Cluster ${message.command.clusterID} is unavailable.`,
                                                clusterID: c.clusterID
                                            },
                                        },
                                    });
                                    this.error(`The cluster I requested (${message.command.clusterID}) is unavailable.`, `Worker ${worker.id}`);
                                }
                            });
                            break;
                        }
                        case "clusterEval": {
                            const cluster = this.clusters.get(message.request.clusterID);
                            if (cluster) {
                                const clusterWorker = master.workers[cluster.workerID];
                                if (clusterWorker) {
                                    clusterWorker.send({
                                        op: "eval",
                                        request: message.request,
                                        UUID: worker.id,
                                    });
                                }
                                else {
                                    worker.send({
                                        op: "return",
                                        id: message.request.UUID,
                                        value: {
                                            value: {
                                                err: `Cluster ${message.request.clusterID} is unavailable.`,
                                                clusterID: cluster.clusterID
                                            },
                                        },
                                    });
                                    this.error(`The cluster I requested (${message.request.clusterID}) is unavailable.`, `Worker ${worker.id}`);
                                }
                            }
                            else {
                                worker.send({
                                    op: "return",
                                    id: message.request.UUID,
                                    value: {
                                        value: {
                                            err: `Cluster ${message.request.clusterID} does not exist.`,
                                            clusterID: cluster.clusterID
                                        },
                                    },
                                });
                                this.error(`The cluster I requested (${message.request.clusterID}) does not exist.`, `Worker ${worker.id}`);
                            }
                            break;
                        }
                        case "serviceEval": {
                            const service = this.services.get(message.request.serviceName);
                            if (service) {
                                const serviceWorker = master.workers[service.workerID];
                                if (serviceWorker) {
                                    serviceWorker.send({
                                        op: "eval",
                                        request: message.request,
                                        UUID: worker.id,
                                    });
                                }
                                else {
                                    worker.send({
                                        op: "return",
                                        id: message.request.UUID,
                                        value: {
                                            value: {
                                                err: `Service ${message.request.serviceName} is unavailable.`,
                                                serviceName: service.serviceName
                                            },
                                        },
                                    });
                                    this.error(`The service I requested (${message.request.serviceName}) is unavailable.`, `Worker ${worker.id}`);
                                }
                            }
                            else {
                                worker.send({
                                    op: "return",
                                    id: message.request.UUID,
                                    value: {
                                        value: {
                                            err: `Service ${message.request.serviceName} does not exist.`,
                                            serviceName: service.serviceName
                                        },
                                    },
                                });
                                this.error(`The service I requested (${message.request.serviceName}) does not exist.`, `Worker ${worker.id}`);
                            }
                            break;
                        }
                        case "allClustersEval": {
                            this.clusters.forEach((c) => {
                                const clusterWorker = master.workers[c.workerID];
                                if (clusterWorker) {
                                    process.nextTick(() => clusterWorker.send({
                                        op: "eval",
                                        request: message.request,
                                        UUID: worker.id
                                    }));
                                }
                                else {
                                    worker.send({
                                        op: "return",
                                        id: message.request.UUID,
                                        value: {
                                            value: {
                                                err: `Cluster ${message.request.clusterID} is unavailable.`,
                                                clusterID: c.clusterID
                                            },
                                        },
                                    });
                                    this.error(`The cluster I requested (${message.request.clusterID}) is unavailable.`, `Worker ${worker.id}`);
                                }
                            });
                            break;
                        }
                        case "return": {
                            const worker = master.workers[message.UUID];
                            if (worker) {
                                const UUID = JSON.stringify({
                                    id: message.value.id,
                                    UUID: message.UUID,
                                });
                                const fetch = this.fetches.get(UUID);
                                if (message.value.noValue) {
                                    if (fetch !== undefined) {
                                        let clustersLaunching = 0;
                                        this.launchingWorkers.forEach((w) => {
                                            if (w.cluster)
                                                clustersLaunching++;
                                        });
                                        if (fetch.checked + 1 == this.clusters.size + clustersLaunching) {
                                            worker.send({
                                                op: "return",
                                                id: message.value.id,
                                                value: null,
                                            });
                                            this.fetches.delete(UUID);
                                        }
                                        else {
                                            this.fetches.set(UUID, Object.assign(fetch, { checked: fetch.checked + 1 }));
                                        }
                                    }
                                }
                                else {
                                    this.fetches.delete(UUID);
                                    worker.send({
                                        op: "return",
                                        id: message.value.id,
                                        value: message.value,
                                    });
                                }
                            }
                            break;
                        }
                        case "collectStats": {
                            if (this.prelimStats && !this.pauseStats) {
                                const recievedTimestamp = new Date().getTime();
                                const cluster = this.clusters.find((c) => c.workerID == worker.id);
                                const service = this.services.find((s) => s.workerID == worker.id);
                                if (cluster) {
                                    this.prelimStats.guilds += message.stats.guilds;
                                    this.prelimStats.users += message.stats.users;
                                    this.prelimStats.members += message.stats.members;
                                    this.prelimStats.voice += message.stats.voice;
                                    this.prelimStats.clustersRam += message.stats.ram;
                                    this.prelimStats.largeGuilds += message.stats.largeGuilds;
                                    this.prelimStats.shardCount += message.stats.shardStats.length;
                                    this.prelimStats.clusters.push(Object.assign(message.stats, { id: cluster.clusterID, ipcLatency: recievedTimestamp - message.stats.ipcLatency }));
                                    if (typeof this.statsWorkersCounted == "number")
                                        this.statsWorkersCounted++;
                                }
                                else if (service) {
                                    this.prelimStats.servicesRam += message.stats.ram;
                                    this.prelimStats.services.push(Object.assign(message.stats, { name: service.serviceName, ipcLatency: recievedTimestamp - message.stats.ipcLatency }));
                                    if (typeof this.statsWorkersCounted == "number")
                                        this.statsWorkersCounted++;
                                }
                                this.prelimStats.totalRam += message.stats.ram;
                            }
                            if (this.statsWorkersCounted === this.clusters.size + this.services.size) {
                                this.prelimStats.masterRam = process.memoryUsage().rss / 1e6;
                                this.prelimStats.totalRam += this.prelimStats.masterRam;
                                const compare = (a, b) => {
                                    if (a.id < b.id)
                                        return -1;
                                    if (a.id > b.id)
                                        return 1;
                                    return 0;
                                };
                                this.stats = Object.assign(this.prelimStats, {
                                    clusters: this.prelimStats.clusters.sort(compare),
                                    timestamp: new Date().getTime()
                                });
                                this.emit("stats", this.stats);
                                if (this.whatToLog.includes("stats_update")) {
                                    this.log("Stats updated.", "Admiral");
                                }
                                // Sends the clusters the latest stats
                                this.broadcast("stats", this.stats);
                            }
                            break;
                        }
                        case "centralApiRequest": {
                            this.centralApiRequest(worker, message.request.UUID, message.request.data);
                            break;
                        }
                        case "getStats": {
                            // Sends the latest stats upon request from the IPC
                            worker.send({
                                op: "return",
                                id: "statsReturn",
                                value: this.stats,
                            });
                            break;
                        }
                        case "broadcast": {
                            this.broadcast(message.event.op, message.event.msg);
                            break;
                        }
                        case "sendTo": {
                            const worker = master.workers[this.clusters.get(message.cluster).workerID];
                            if (worker) {
                                worker.send({ op: "ipcEvent", event: message.event.op, msg: message.event.msg });
                            }
                            break;
                        }
                        case "restartCluster": {
                            this.restartCluster(message.clusterID, message.hard);
                            break;
                        }
                        case "restartAllClusters": {
                            this.restartAllClusters(message.hard);
                            break;
                        }
                        case "restartService": {
                            this.restartService(message.serviceName, message.hard);
                            break;
                        }
                        case "restartAllServices": {
                            this.restartAllServices(message.hard);
                            break;
                        }
                        case "shutdownCluster": {
                            this.shutdownCluster(message.clusterID, message.hard);
                            break;
                        }
                        case "shutdownService": {
                            this.shutdownService(message.serviceName, message.hard);
                            break;
                        }
                        case "createService": {
                            this.createService(message.serviceName, message.servicePath);
                            break;
                        }
                        case "totalShutdown": {
                            this.totalShutdown(message.hard);
                            break;
                        }
                        case "reshard": {
                            this.reshard(message.options);
                            break;
                        }
                        case "admiralBroadcast": {
                            this.emit(message.event.op, message.event.msg);
                            break;
                        }
                        case "getAdmiralInfo": {
                            worker.send({
                                op: "return",
                                id: "admiralInfo",
                                value: {
                                    clusters: Object.fromEntries(this.clusters),
                                    services: Object.fromEntries(this.services)
                                }
                            });
                            break;
                        }
                    }
                }
            });
            cluster_1.on("disconnect", (worker) => {
                const cluster = this.clusters.find((c) => c.workerID == worker.id);
                const service = this.services.find((s) => s.workerID == worker.id);
                if (cluster) {
                    this.warn(`Cluster ${cluster.clusterID} disconnected :(`, "Admiral");
                }
                else if (service) {
                    this.warn(`Service ${service.serviceName} disconnected :(`, "Admiral");
                }
            });
            cluster_1.on("exit", (worker, code, signal) => {
                var _a;
                if (this.softKills.get(worker.id)) {
                    const name = () => {
                        const cluster = this.clusters.find((c) => c.workerID == worker.id);
                        const service = this.services.find((s) => s.workerID == worker.id);
                        if (cluster) {
                            return "Cluster " + cluster.clusterID;
                        }
                        else if (service) {
                            return "Service " + service.serviceName;
                        }
                        else {
                            return "Worker " + worker.id;
                        }
                    };
                    this.warn(name() + " died during a soft kill.", "Admiral");
                    this.queue.execute();
                    (_a = this.softKills.get(worker.id)) === null || _a === void 0 ? void 0 : _a.fn(true);
                }
                else {
                    const restartItem = this.restartWorker(worker);
                    if (restartItem)
                        this.queue.item(restartItem);
                }
            });
            this.queue.on("execute", (item, prevItem) => {
                const worker = master.workers[item.workerID];
                if (worker) {
                    if (item.message.op == "connect") {
                        const concurrency = () => {
                            if (item.type === "service" && this.startServicesTogether && this.queue.queue[1]) {
                                // start services together
                                if (this.queue.queue[1].type === "service") {
                                    const currentServiceName = item.message.serviceName;
                                    const nextServiceName = this.queue.queue[1].message.serviceName;
                                    if (currentServiceName !== nextServiceName) {
                                        this.queue.execute();
                                    }
                                }
                            }
                            else if (item.type === "cluster" && this.queue.queue[1]) {
                                // start clusters together
                                if (this.queue.queue[1].type === "cluster") {
                                    const currentClusterID = item.message.clusterID;
                                    const nextClusterID = this.queue.queue[1].message.clusterID;
                                    const clusterToGroupMap = this.chunkConcurrencyGroups();
                                    const currentClusterGroup = clusterToGroupMap.get(currentClusterID);
                                    const nextClusterGroup = clusterToGroupMap.get(nextClusterID);
                                    if ((currentClusterID & this.maxConcurrency) === 0) {
                                        if (currentClusterGroup === 0) {
                                            if (this.whatToLog.includes("concurrency_group_starting") && this.maxConcurrency > 1)
                                                this.log(`Starting concurrency cluster group ${currentClusterGroup}`, "Admiral");
                                        }
                                    }
                                    if (currentClusterGroup === nextClusterGroup) {
                                        this.queue.execute();
                                    }
                                }
                            }
                        };
                        const lr = this.launchingManager.get(item.workerID);
                        if (lr) {
                            worker.send(item.message);
                            this.launchingManager.delete(item.workerID);
                            concurrency();
                        }
                        else {
                            this.launchingManager.set(item.workerID, {
                                waiting: () => {
                                    worker.send(item.message);
                                    concurrency();
                                },
                            });
                        }
                    }
                    else if (item.message.op == "shutdown") {
                        worker.send(item.message);
                        setTimeout(() => {
                            var _a;
                            if (this.queue.queue[0])
                                if (this.queue.queue[0].workerID == item.workerID) {
                                    const worker = master.workers[item.workerID];
                                    if (worker) {
                                        worker.kill();
                                        const name = () => {
                                            const cluster = this.clusters.find((c) => c.workerID == item.workerID);
                                            const service = this.services.find((s) => s.workerID == item.workerID);
                                            if (cluster) {
                                                return "Cluster " + cluster.clusterID;
                                            }
                                            else if (service) {
                                                return "Service " + service.serviceName;
                                            }
                                            else {
                                                return "Worker " + item.workerID;
                                            }
                                        };
                                        this.warn("Safe shutdown failed for " + name() + ". Preformed hard shutdown instead.", "Admiral");
                                        if (this.softKills.get(item.workerID)) {
                                            (_a = this.softKills.get(item.workerID)) === null || _a === void 0 ? void 0 : _a.fn(true);
                                        }
                                    }
                                }
                        }, this.killTimeout);
                    }
                    else {
                        worker.send(item.message);
                    }
                }
            });
        }
    }
    launch() {
        this.launchingWorkers.clear();
        this.pauseStats = true;
        if (master.isMaster) {
            process.on("uncaughtException", (e) => this.error(e));
            process.nextTick(() => {
                if (this.whatToLog.includes("admiral_start")) {
                    if (this.resharding) {
                        this.log("Resharding", "Fleet");
                    }
                    else {
                        this.log("Started Admiral", "Fleet");
                    }
                }
                this.calculateShards().then((shards) => {
                    if (this.lastShardID === 0) {
                        this.lastShardID = shards - 1;
                    }
                    this.shardCount = shards;
                    // Chunk
                    const shardsByID = [];
                    for (let i = this.firstShardID; i <= this.lastShardID; i++) {
                        shardsByID.push(i);
                    }
                    this.chunks = this.chunk(shardsByID, Number(this.clusterCount));
                    this.clusterCount = this.chunks.length;
                    if (this.whatToLog.includes("admiral_start")) {
                        this.log(`Starting ${shards} shard(s) in ${this.clusterCount} cluster(s)`, "Admiral");
                    }
                    let opts;
                    if (this.nodeArgs) {
                        opts = {
                            silent: false,
                            execArgv: this.nodeArgs,
                        };
                    }
                    else {
                        opts = {
                            silent: false,
                        };
                    }
                    master.setupMaster(opts);
                    // Start stuff
                    if (this.servicesToCreate && !this.resharding) {
                        this.startService(this.servicesToCreate);
                    }
                    else {
                        this.startCluster();
                    }
                });
            });
        }
        else if (master.isWorker) {
            if (process.env.type === "cluster") {
                new Cluster_1.Cluster({
                    erisClient: this.erisClient,
                    fetchTimeout: this.fetchTimeout,
                    overrideConsole: this.overrideConsole
                });
            }
            else if (process.env.type === "service") {
                new Service_1.Service({
                    fetchTimeout: this.fetchTimeout,
                    overrideConsole: this.overrideConsole
                });
            }
        }
    }
    centralApiRequest(worker, UUID, data) {
        const reply = (resolved, value) => {
            worker.send({
                op: "centralApiResponse",
                id: UUID,
                value: {
                    resolved,
                    value
                }
            });
        };
        if (data.fileString && data.file) {
            data.file.file = Buffer.from(data.fileString, "base64");
        }
        this.eris.requestHandler.request(data.method, data.url, data.auth, data.body, data.file, data._route, data.short)
            .then((value) => {
            reply(true, value);
        })
            .catch((error) => {
            const msg = {
                convertedErrorObject: false,
                error
            };
            if (error instanceof Error) {
                msg.error = ErrorHandler_1.errorToJSON(error);
                msg.convertedErrorObject = true;
            }
            reply(false, msg);
        });
    }
    /**
     * Restarts a specific cluster
     * @param clusterID ID of the cluster to restart
     * @param hard Whether to ignore the soft shutdown function
    */
    restartCluster(clusterID, hard) {
        const workerID = this.clusters.find((c) => c.clusterID == clusterID).workerID;
        if (workerID) {
            const worker = master.workers[workerID];
            if (worker) {
                const restartItem = this.restartWorker(worker, true, hard ? false : true);
                if (restartItem)
                    this.queue.item(restartItem);
            }
        }
    }
    /**
     * Restarts all clusters
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllClusters(hard) {
        const queueItems = [];
        let completed = 0;
        this.clusters.forEach((cluster) => {
            process.nextTick(() => {
                completed++;
                const workerID = this.clusters.find((c) => c.clusterID == cluster.clusterID).workerID;
                const worker = master.workers[workerID];
                if (worker) {
                    const restartItem = this.restartWorker(worker, true, hard ? false : true);
                    if (restartItem)
                        queueItems.push(restartItem);
                }
                // run
                if (completed >= this.clusters.size) {
                    this.queue.bunkItems(queueItems);
                }
            });
        });
    }
    /**
     * Restarts a specific service
     * @param serviceName Name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    restartService(serviceName, hard) {
        const workerID = this.services.find((s) => s.serviceName == serviceName).workerID;
        if (workerID) {
            const worker = master.workers[workerID];
            if (worker) {
                const restartItem = this.restartWorker(worker, true, hard ? false : true);
                if (restartItem)
                    this.queue.item(restartItem);
            }
        }
    }
    /**
     * Restarts all services
     * @param hard Whether to ignore the soft shutdown function
    */
    restartAllServices(hard) {
        const queueItems = [];
        let completed = 0;
        this.services.forEach((service) => {
            process.nextTick(() => {
                completed++;
                const workerID = this.services.find((s) => s.serviceName == service.serviceName).workerID;
                const worker = master.workers[workerID];
                if (worker) {
                    const restartItem = this.restartWorker(worker, true, hard ? false : true);
                    if (restartItem)
                        queueItems.push(restartItem);
                }
                // run
                if (completed >= this.services.size) {
                    this.queue.bunkItems(queueItems);
                }
            });
        });
    }
    /**
     * Shuts down a cluster
     * @param clusterID The ID of the cluster to shutdown
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownCluster(clusterID, hard) {
        const workerID = this.clusters.find((c) => c.clusterID == clusterID).workerID;
        if (workerID) {
            const worker = master.workers[workerID];
            if (worker) {
                const shutdownItem = this.shutdownWorker(worker, hard ? false : true);
                this.queue.item(shutdownItem);
            }
        }
    }
    /**
     * Shuts down a cluster
     * @param serviceName The name of the service
     * @param hard Whether to ignore the soft shutdown function
    */
    shutdownService(serviceName, hard) {
        const workerID = this.services.find((s) => s.serviceName == serviceName).workerID;
        if (workerID) {
            const worker = master.workers[workerID];
            if (worker) {
                const shutdownItem = this.shutdownWorker(worker, hard ? false : true);
                this.queue.item(shutdownItem);
            }
            // remove from services to create
            if (this.servicesToCreate) {
                this.servicesToCreate.splice(this.servicesToCreate.findIndex(s => s.name === serviceName), 1);
            }
        }
    }
    /**
     * Create a service
     * @param serviceName Unique ame of the service
     * @param servicePath Absolute path to the service file
     */
    createService(serviceName, servicePath) {
        // if path is not absolute
        if (!path.isAbsolute(servicePath)) {
            this.error("Service path must be absolute!", "Admiral");
            return;
        }
        const serviceCreator = {
            name: serviceName,
            path: servicePath
        };
        this.startService([serviceCreator], true);
        // add to creation array
        if (this.servicesToCreate) {
            this.servicesToCreate.push(serviceCreator);
        }
    }
    /**
     * Shuts down everything and exits the master process
     * @param hard Whether to ignore the soft shutdown function
    */
    totalShutdown(hard) {
        if (this.whatToLog.includes("total_shutdown")) {
            this.log("Starting total fleet shutdown.", "Admiral");
        }
        if (hard) {
            if (this.whatToLog.includes("total_shutdown")) {
                this.log("Total fleet hard shutdown complete. Ending process.", "Admiral");
            }
            process.exit(0);
        }
        else {
            // clear queue
            this.queue.override = "shutdownWorker";
            this.queue.queue = [];
            let total = 0;
            let done = 0;
            const doneFn = () => {
                done++;
                if (done == total) {
                    // clear override
                    this.queue.override = undefined;
                    if (this.whatToLog.includes("total_shutdown")) {
                        this.log("Total fleet shutdown complete. Ending process.", "Admiral");
                    }
                    process.exit(0);
                }
            };
            const queueItems = [];
            let completedVal = 0;
            const checkCompleted = () => {
                completedVal++;
                if (completedVal >= this.clusters.size + this.services.size + this.launchingWorkers.size) {
                    if (this.shutdownTogether) {
                        this.queue.bunkItems(queueItems, "shutdownWorker");
                    }
                    else {
                        queueItems.forEach(qi => this.queue.item(qi, "shutdownWorker"));
                    }
                }
            };
            this.clusters.forEach((cluster) => {
                total++;
                process.nextTick(() => {
                    const worker = master.workers[cluster.workerID];
                    if (worker) {
                        const shutdownItem = this.shutdownWorker(worker, hard ? false : true, doneFn);
                        queueItems.push(shutdownItem);
                        checkCompleted();
                    }
                });
            });
            this.services.forEach((service) => {
                total++;
                process.nextTick(() => {
                    const worker = master.workers[service.workerID];
                    if (worker) {
                        const shutdownItem = this.shutdownWorker(worker, hard ? false : true, doneFn);
                        queueItems.push(shutdownItem);
                        checkCompleted();
                    }
                });
            });
            this.launchingWorkers.forEach((workerData, workerID) => {
                total++;
                process.nextTick(() => {
                    const worker = master.workers[workerID];
                    if (worker) {
                        const shutdownItem = this.shutdownWorker(worker, hard ? false : true, doneFn);
                        queueItems.push(shutdownItem);
                        checkCompleted();
                    }
                });
            });
        }
    }
    /** Reshard
     * @param options Change the resharding options
    */
    reshard(options) {
        if (!this.resharding) {
            const oldClusters = new Collection_1.Collection;
            this.clusters.forEach((o) => {
                oldClusters.set(o.clusterID, o);
            });
            this.resharding = true;
            // set new values
            if (options) {
                if (options.guildsPerShard)
                    this.guildsPerShard = options.guildsPerShard;
                if (options.firstShardID)
                    this.firstShardID = options.firstShardID;
                if (options.lastShardID)
                    this.lastShardID = options.lastShardID;
                if (options.shards)
                    this.shardCount = options.shards || "auto";
                if (options.clusters)
                    this.clusterCount = options.clusters || "auto";
            }
            this.launch();
            this.once("ready", () => {
                this.resharding = false;
                if (this.whatToLog.includes("resharding_worker_killed")) {
                    this.log("Killing old clusters", "Admiral");
                }
                let i = 0;
                const queueItems = [];
                oldClusters.forEach((c) => {
                    const oldWorker = master.workers[c.workerID];
                    if (oldWorker) {
                        const shutdownItem = this.shutdownWorker(oldWorker, true, () => {
                            if (this.whatToLog.includes("resharding_worker_killed")) {
                                this.log(`Killed old worker for cluster ${c.clusterID}`, "Admiral");
                            }
                            const newWorker = master.workers[this.clusters.find((newC) => newC.clusterID == c.clusterID).workerID];
                            if (this.whatToLog.includes("resharding_transition")) {
                                this.log(`Transitioning to new worker for cluster ${c.clusterID}`, "Admiral");
                            }
                            if (newWorker)
                                newWorker.send({ op: "loadCode" });
                            i++;
                            if (i == oldClusters.size) {
                                // load code for new clusters
                                this.clusters.forEach((c) => {
                                    if (!oldClusters.get(c.clusterID)) {
                                        const newWorker = master.workers[c.workerID];
                                        if (newWorker)
                                            newWorker.send({ op: "loadCode" });
                                        if (this.whatToLog.includes("resharding_transition")) {
                                            this.log(`Loaded code for new cluster ${c.clusterID}`, "Admiral");
                                        }
                                    }
                                });
                                if (this.whatToLog.includes("resharding_transition_complete")) {
                                    this.log("Transitioned all clusters to the new workers!", "Admiral");
                                }
                            }
                        }, { clusters: oldClusters });
                        queueItems.push(shutdownItem);
                    }
                });
                this.queue.bunkItems(queueItems);
            });
        }
        else {
            this.error("Already resharding!", "Admiral");
        }
    }
    async startService(servicesToStart, onlyServices) {
        if (!servicesToStart)
            servicesToStart = this.servicesToCreate;
        if (servicesToStart) {
            const queueItems = [];
            for (let i = 0; i < servicesToStart.length; i++) {
                const service = servicesToStart[i];
                const worker = master.fork({
                    type: "service",
                    NODE_ENV: process.env.NODE_ENV,
                });
                /* this.services.set(service.name, {
                    workerID: worker.id,
                    path: service.path,
                    serviceName: service.name,
                }); */
                this.launchingWorkers.set(worker.id, {
                    service: {
                        path: service.path,
                        serviceName: service.name,
                        workerID: worker.id,
                    },
                });
                queueItems.push({
                    type: "service",
                    workerID: worker.id,
                    message: {
                        serviceName: service.name,
                        path: service.path,
                        op: "connect",
                        timeout: this.serviceTimeout,
                        whatToLog: this.whatToLog,
                    },
                });
                if (this.whatToLog.includes("service_launch")) {
                    this.log("Launching service " + service.name, "Admiral");
                }
            }
            // add all items at once
            this.queue.bunkItems(queueItems);
        }
        process.nextTick(() => {
            if (this.whatToLog.includes("all_services_launched")) {
                this.log("All services launched!", "Admiral");
            }
            if (!onlyServices)
                this.startCluster();
        });
    }
    startCluster() {
        for (let i = 0; i < this.clusterCount; i++) {
            const worker = master.fork({
                type: "cluster",
                NODE_ENV: process.env.NODE_ENV,
            });
            /* this.clusters.set(i, {
                workerID: worker.id,
                firstShardID: 0,
                lastShardID: 0,
                clusterID: i,
            }); */
            this.launchingWorkers.set(worker.id, {
                cluster: {
                    firstShardID: 0,
                    lastShardID: 0,
                    clusterID: i,
                    workerID: worker.id,
                },
            });
            if (this.whatToLog.includes("cluster_launch"))
                this.log("Launching cluster " + i, "Admiral");
        }
        if (this.whatToLog.includes("all_clusters_launched"))
            this.log("All clusters launched!", "Admiral");
        if (this.chunks)
            this.chunks.forEach((chunk, clusterID) => {
                const workerID = this.launchingWorkers.find((w) => { var _a; return ((_a = w.cluster) === null || _a === void 0 ? void 0 : _a.clusterID) == clusterID; }).cluster.workerID;
                /* this.clusters.set(clusterID, {
                    workerID: workerID,
                    firstShardID: Math.min(...chunk),
                    lastShardID: Math.max(...chunk),
                    clusterID: clusterID,
                }); */
                this.launchingWorkers.set(workerID, {
                    cluster: {
                        firstShardID: Math.min(...chunk),
                        lastShardID: Math.max(...chunk),
                        clusterID: clusterID,
                        workerID: workerID,
                    },
                });
            });
        // Connects shards
        const queueItems = [];
        for (const i in [...Array(this.clusterCount).keys()]) {
            const ID = Number(i);
            const cluster = this.launchingWorkers.find((w) => { var _a; return ((_a = w.cluster) === null || _a === void 0 ? void 0 : _a.clusterID) == ID; }).cluster;
            queueItems.push({
                type: "cluster",
                workerID: cluster.workerID,
                message: {
                    clusterID: ID,
                    clusterCount: Number(this.clusterCount),
                    op: "connect",
                    firstShardID: cluster.firstShardID,
                    lastShardID: cluster.lastShardID,
                    shardCount: Number(this.shardCount),
                    token: this.token,
                    path: this.path,
                    clientOptions: this.clientOptions,
                    whatToLog: this.whatToLog,
                    startingStatus: this.startingStatus,
                    useCentralRequestHandler: this.useCentralRequestHandler,
                    loadClusterCodeImmediately: this.loadClusterCodeImmediately,
                    resharding: this.resharding
                },
            });
        }
        if (this.whatToLog.includes("shards_spread"))
            this.log("All shards spread!", "Admiral");
        this.queue.bunkItems(queueItems);
    }
    async calculateShards() {
        let shards = this.shardCount;
        const gateway = await this.eris.getBotGateway();
        if (!this.maxConcurrencyOverride)
            this.maxConcurrency = gateway.session_start_limit.max_concurrency;
        if (this.whatToLog.includes("gateway_shards")) {
            this.log(`Gateway recommends ${gateway.shards} shards. Using ${this.maxConcurrency} max concurrency.`, "Admiral");
        }
        if (shards === "auto") {
            shards = Number(gateway.shards);
            if (shards === 1) {
                return Promise.resolve(shards);
            }
            else {
                return Promise.resolve(Math.ceil((shards * 1000) / this.guildsPerShard));
            }
        }
        else {
            return Promise.resolve(shards);
        }
    }
    chunkConcurrencyGroups() {
        const clusterGroupMap = new Map();
        let currentGroup = 0;
        for (let i = 0; i < this.clusterCount; i++) {
            if (i - currentGroup * this.maxConcurrency === this.maxConcurrency) {
                currentGroup++;
            }
            clusterGroupMap.set(i, currentGroup);
        }
        return clusterGroupMap;
    }
    chunk(shards, clusters) {
        if (clusters < 2)
            return [shards];
        const length = shards.length;
        const r = [];
        let i = 0;
        let size;
        if (length % clusters === 0) {
            size = Math.floor(length / clusters);
            while (i < length) {
                r.push(shards.slice(i, (i += size)));
            }
        }
        else {
            while (i < length) {
                size = Math.ceil((length - i) / clusters--);
                r.push(shards.slice(i, (i += size)));
            }
        }
        return r;
    }
    shutdownWorker(worker, soft, callback, customMaps) {
        let cluster;
        let service;
        let launchingWorker;
        if (customMaps) {
            if (customMaps.clusters) {
                cluster = customMaps.clusters.find((c) => c.workerID == worker.id);
            }
            else {
                cluster = this.clusters.find((c) => c.workerID == worker.id);
            }
            if (customMaps.services) {
                service = customMaps.services.find((s) => s.workerID == worker.id);
            }
            else {
                service = this.services.find((s) => s.workerID == worker.id);
            }
            if (customMaps.launchingWorkers) {
                launchingWorker = customMaps.launchingWorkers.get(worker.id);
            }
        }
        else {
            cluster = this.clusters.find((c) => c.workerID == worker.id);
            service = this.services.find((s) => s.workerID == worker.id);
            launchingWorker = this.launchingWorkers.get(worker.id);
        }
        if (launchingWorker) {
            if (launchingWorker.cluster) {
                cluster = launchingWorker.cluster;
            }
            else if (launchingWorker.service) {
                service = launchingWorker.service;
            }
        }
        const item = {
            workerID: worker.id,
            type: "n",
            message: {
                op: "shutdown"
            },
        };
        if (cluster) {
            if (soft) {
                // Preform soft shutdown
                this.softKills.set(worker.id, {
                    fn: (failed) => {
                        if (!failed) {
                            this.log(`Safely shutdown cluster ${cluster.clusterID}`, "Admiral");
                            worker.kill();
                        }
                        if (!customMaps) {
                            this.clusters.delete(cluster.clusterID);
                            // if was launching
                            this.launchingWorkers.delete(worker.id);
                        }
                        this.softKills.delete(worker.id);
                        this.queue.execute(false, "shutdownWorker");
                        if (callback)
                            callback();
                    },
                });
                if (this.whatToLog.includes("cluster_shutdown")) {
                    this.log(`Performing soft shutdown of cluster ${cluster.clusterID}`, "Admiral");
                }
            }
            else {
                worker.kill();
                if (this.whatToLog.includes("cluster_shutdown")) {
                    this.log(`Hard shutdown of cluster ${cluster.clusterID} complete`, "Admiral");
                }
                if (!customMaps)
                    this.clusters.delete(cluster.clusterID);
            }
            item.type = "cluster";
        }
        else if (service) {
            if (soft) {
                // Preform soft shutdown
                this.softKills.set(worker.id, {
                    fn: () => {
                        this.log(`Safely shutdown service ${service.serviceName}`, "Admiral");
                        worker.kill();
                        if (!customMaps) {
                            this.services.delete(service.serviceName);
                            // if was launching
                            this.launchingWorkers.delete(worker.id);
                        }
                        this.softKills.delete(worker.id);
                        this.queue.execute(false, "shutdownWorker");
                        if (callback)
                            callback();
                    },
                });
                if (this.whatToLog.includes("service_shutdown")) {
                    this.log(`Performing soft shutdown of service ${service.serviceName}`, "Admiral");
                }
            }
            else {
                worker.kill();
                if (this.whatToLog.includes("service_shutdown")) {
                    this.log(`Hard shutdown of service ${service.serviceName} complete`, "Admiral");
                }
                if (!customMaps)
                    this.services.delete(service.serviceName);
            }
            item.type = "service";
        }
        return item;
    }
    restartWorker(worker, manual, soft) {
        const cluster = this.clusters.find((c) => c.workerID == worker.id);
        const service = this.services.find((s) => s.workerID == worker.id);
        let item;
        if (cluster) {
            const newWorker = master.fork({
                NODE_ENV: process.env.NODE_ENV,
                type: "cluster",
            });
            this.launchingWorkers.set(newWorker.id, {
                cluster: {
                    firstShardID: cluster.firstShardID,
                    lastShardID: cluster.lastShardID,
                    clusterID: cluster.clusterID,
                    workerID: newWorker.id,
                }
            });
            if (soft) {
                // Preform soft restart
                this.pauseStats = true;
                this.softKills.set(newWorker.id, {
                    fn: () => {
                        this.softKills.delete(newWorker.id);
                        if (this.whatToLog.includes("cluster_restart")) {
                            this.log(`Killing old worker for cluster ${cluster.clusterID}`, "Admiral");
                        }
                        const shutdownItem = this.shutdownWorker(worker, true, () => {
                            if (this.whatToLog.includes("cluster_restart")) {
                                this.log(`Killed old worker for cluster ${cluster.clusterID}`, "Admiral");
                            }
                            newWorker.send({ op: "loadCode" });
                            this.clusters.delete(cluster.clusterID);
                            this.clusters.set(cluster.clusterID, Object.assign(cluster, { workerID: newWorker.id }));
                            this.pauseStats = false;
                        });
                        this.queue.item(shutdownItem);
                    },
                    type: "cluster",
                    id: cluster.clusterID,
                });
                if (this.whatToLog.includes("cluster_restart")) {
                    this.log(`Performing soft restart of cluster ${cluster.clusterID}`, "Admiral");
                }
            }
            else {
                if (manual) {
                    worker.kill();
                    this.warn(`Cluster ${cluster.clusterID} killed upon request`, "Admiral");
                }
                else {
                    this.warn(`Cluster ${cluster.clusterID} died :(`, "Admiral");
                }
                this.clusters.delete(cluster.clusterID);
                this.clusters.set(cluster.clusterID, Object.assign(cluster, { workerID: newWorker.id }));
                if (this.whatToLog.includes("cluster_restart")) {
                    this.log(`Restarting cluster ${cluster.clusterID}`, "Admiral");
                }
            }
            item = {
                workerID: newWorker.id,
                type: "cluster",
                message: {
                    clusterID: cluster.clusterID,
                    clusterCount: Number(this.clusterCount),
                    op: "connect",
                    firstShardID: cluster.firstShardID,
                    lastShardID: cluster.lastShardID,
                    shardCount: Number(this.shardCount),
                    token: this.token,
                    path: this.path,
                    clientOptions: this.clientOptions,
                    whatToLog: this.whatToLog,
                    startingStatus: this.startingStatus,
                    useCentralRequestHandler: this.useCentralRequestHandler,
                    loadClusterCodeImmediately: this.loadClusterCodeImmediately,
                    resharding: this.resharding
                },
            };
        }
        else if (service) {
            const newWorker = master.fork({
                NODE_ENV: process.env.NODE_ENV,
                type: "service",
            });
            this.launchingWorkers.set(newWorker.id, {
                service: {
                    path: service.path,
                    serviceName: service.serviceName,
                    workerID: newWorker.id,
                }
            });
            if (soft) {
                // Preform soft restart
                this.softKills.set(newWorker.id, {
                    fn: () => {
                        this.softKills.delete(newWorker.id);
                        if (this.whatToLog.includes("service_restart")) {
                            this.log(`Killing old worker for service ${service.serviceName}`, "Admiral");
                        }
                        const shutdownItem = this.shutdownWorker(worker, true, () => {
                            if (this.whatToLog.includes("service_restart")) {
                                this.log(`Killed old worker for service ${service.serviceName}`, "Admiral");
                            }
                            this.services.delete(service.serviceName);
                            this.services.set(service.serviceName, Object.assign(service, { workerID: newWorker.id }));
                        });
                        this.queue.item(shutdownItem);
                    },
                    type: "service",
                    id: service.serviceName,
                });
                if (this.whatToLog.includes("service_restart")) {
                    this.log(`Performing soft restart of service ${service.serviceName}`, "Admiral");
                }
            }
            else {
                if (manual) {
                    worker.kill();
                    this.warn(`Service ${service.serviceName} killed upon request`, "Admiral");
                }
                else {
                    this.warn(`Service ${service.serviceName} died :(`, "Admiral");
                }
                this.services.delete(service.serviceName);
                this.services.set(service.serviceName, Object.assign(service, { workerID: newWorker.id }));
                if (this.whatToLog.includes("service_restart")) {
                    this.log(`Restarting service ${service.serviceName}`, "Admiral");
                }
            }
            item = {
                workerID: newWorker.id,
                type: "service",
                message: {
                    serviceName: service.serviceName,
                    path: service.path,
                    op: "connect",
                    timeout: this.serviceTimeout,
                    whatToLog: this.whatToLog,
                },
            };
        }
        return item;
        /*if ((service || cluster) && item) {
            if (this.queue.queue[0]) {
                if (this.queue.queue[0].workerID == worker.id) {
                    this.queue.queue[0] = item;
                    this.queue.execute(true);
                } else {
                    this.queue.item(item);
                }
            } else {
                this.queue.item(item);
            }
        }*/
    }
    fetchInfo(op, id, UUID) {
        const mapUUID = JSON.stringify({ id, UUID });
        this.fetches.set(mapUUID, { UUID, op, id, checked: 0 });
        for (let i = 0; this.clusters.get(i); i++) {
            process.nextTick(() => {
                const cluster = this.clusters.get(i);
                const worker = master.workers[cluster.workerID];
                if (worker)
                    worker.send({ op, id, UUID });
            });
        }
        setTimeout(() => {
            if (this.fetches.get(mapUUID)) {
                this.fetches.delete(mapUUID);
                const worker = master.workers[UUID];
                if (worker) {
                    worker.send({
                        op: "return",
                        id: id,
                        value: null,
                    });
                }
            }
        }, this.fetchTimeout);
    }
    startStats() {
        this.pauseStats = false;
        this.statsStarted = true;
        if (this.statsInterval !== "disable") {
            const execute = () => {
                this.prelimStats = {
                    guilds: 0,
                    users: 0,
                    members: 0,
                    clustersRam: 0,
                    servicesRam: 0,
                    masterRam: 0,
                    totalRam: 0,
                    voice: 0,
                    largeGuilds: 0,
                    shardCount: 0,
                    clusters: [],
                    services: [],
                    timestamp: 0
                };
                this.statsWorkersCounted = 0;
                this.clusters.forEach((c) => {
                    process.nextTick(() => {
                        const worker = master.workers[c.workerID];
                        if (worker)
                            worker.send({ op: "collectStats" });
                    });
                });
                this.services.forEach((s) => {
                    process.nextTick(() => {
                        const worker = master.workers[s.workerID];
                        if (worker)
                            worker.send({ op: "collectStats" });
                    });
                });
            };
            setInterval(() => {
                if (!this.pauseStats)
                    execute();
            }, this.statsInterval);
            // First execution
            execute();
        }
    }
    broadcast(op, msg) {
        if (!msg)
            msg = null;
        this.clusters.forEach((c) => {
            const worker = master.workers[c.workerID];
            if (worker)
                process.nextTick(() => worker.send({ op: "ipcEvent", event: op, msg }));
        });
        this.services.forEach((s) => {
            const worker = master.workers[s.workerID];
            if (worker)
                process.nextTick(() => worker.send({ op: "ipcEvent", event: op, msg }));
        });
    }
    ipcLog(type, message, worker) {
        // convert log if convered
        let messageToLog = message;
        let source;
        if (message !== null && message !== undefined && typeof message !== "string" && message instanceof Object) {
            if ("ipcLogObject" in message) {
                const ipcHandledMessage = message;
                source = ipcHandledMessage.source;
                messageToLog = ipcHandledMessage.msg;
                if (ipcHandledMessage.valueTranslatedFrom) {
                    switch (ipcHandledMessage.valueTranslatedFrom) {
                        case "Error": {
                            messageToLog = ErrorHandler_1.reconstructError(ipcHandledMessage.msg);
                            break;
                        }
                    }
                }
            }
        }
        else {
            messageToLog = message;
        }
        if (!source) {
            let cluster = this.clusters.find((c) => c.workerID == worker.id);
            let service = this.services.find((s) => s.workerID == worker.id);
            if (!service && !cluster) {
                const soft = this.softKills.get(worker.id);
                const launching = this.launchingWorkers.get(worker.id);
                if (soft) {
                    if (soft.type == "cluster") {
                        cluster = { clusterID: soft.id };
                    }
                    else if (soft.type == "service") {
                        service = { serviceName: soft.id };
                    }
                }
                else if (launching) {
                    if (launching.cluster) {
                        cluster = { clusterID: launching.cluster.clusterID };
                    }
                    else if (launching.service) {
                        service = { serviceName: launching.service.serviceName };
                    }
                }
            }
            if (cluster) {
                source = `Cluster ${cluster.clusterID}`;
            }
            else if (service) {
                source = `Service ${service.serviceName}`;
            }
        }
        this.emitLog(type, messageToLog, source);
    }
    emitLog(type, message, source) {
        let log = message;
        if (this.objectLogging) {
            log = {
                source,
                message: message,
                timestamp: new Date().getTime(),
            };
        }
        else {
            if (source) {
                log = `${source} | ${typeof message === "string" ? message : util_1.inspect(message)}`;
            }
        }
        this.emit(type, log);
    }
    error(message, source) {
        this.emitLog("error", message, source);
    }
    debug(message, source) {
        this.emitLog("debug", message, source);
    }
    log(message, source) {
        this.emitLog("log", message, source);
    }
    warn(message, source) {
        this.emitLog("warn", message, source);
    }
    getCentralRequestHandlerLatency() {
        return this.eris.requestHandler.latencyRef.latency;
    }
}
exports.Admiral = Admiral;
//# sourceMappingURL=Admiral.js.map