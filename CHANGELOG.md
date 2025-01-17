# Changelog

This may skip some little bug fixes.

## 0.3.9
- Added support for extended eris class

## 0.3.8
- Cluster and service control are now accessible via the "Admiral" class

## 0.3.7
- Fix error on ipc service command when a non-object is the return value

## 0.3.6
- Updated ipc.fetchMember to use Eris's guild.fetchMembers function. This should fix it only returning cached members
- Updated Eris from 0.14.0 to 0.15.0

## 0.3.4
Fixed [issue 60](https://github.com/danclay/eris-fleet/issues/60) where Discord snowflake IDs were being treated as numbers. They are now treated as strings.

## 0.3.0
- Added resharding
- Fixed some issues with the IPC
- Added an optional starting status
- Added some documentation in README.md
- Fetch now returns null if there is no value found
- Fetch now only checks clusters which are connected and will get the data from clusters when they launch unless the timeout has passed
- Now uses eslint to make code look sharp


## 0.2.3
- Fixed issue where logging "prefix" would not show up during a soft restart

## 0.2.2
- Added fetch ipc commands to services
- Added more detailed stats
- Added object logging (with the source, timestamp, and the message in an object)

## 0.2.1

- Fixed bug where workers would never connect due to the connect command being sent before they were launched.
- Fixed stats not starting as soon as all the clusters are ready
- Fixed Stats.shardCount always being 0
- Fixed stats RAM not being in MB

## 0.2.0

- Added shutdowns and restarts. They are as follows:

| Function | Description |
|-|-|
| `ipc.shutdownCluster(Number, Boolean)` | Shuts down a cluster down based on the cluster's ID |
| `ipc.shutdownService(String, Boolean)` | Shuts a service down based on the service's name |
| `ipc.restartCluster(Number, Boolean)` | Restarts a cluster based on the cluster's ID |
| `ipc.restartService(String, Boolean)` | Restarts a cluster based on the service's name |
| `ipc.restartAllClusters(Boolean)` | Restarts all clusters |
| `ipc.restartAllServices(Boolean)` | Restarts all services |
| `ipc.totalShutdown(Boolean)` | Shuts down all clusters and services gracefully and exits the process when complete |

- Added graceful and hard shutdowns of clusters and services (Boolean above should be true for a hard shutdown)
- Added soft restarts of clusters and services which limits downtime by only killing the old worker after the new one is ready (Boolean above should be true for a hard restart with downtime)
- Added warn option to logging
- Added logging customization (see README for more details)
- Added less logging option (see README for more details)
- Added shard disconnection errors being logged
- Added error reporting for an error occuring while starting a service `this.serviceStartingError(Error)`
- Moved `this.restartCluster(Number)` to the IPC, so it is now `this.ipc.restartCluster(Number)`
- Added fetch functionality to services