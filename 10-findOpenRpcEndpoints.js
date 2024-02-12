import axios from 'axios';

async function getPeers (rpcUrl) {
    try {
        const { data } = await axios.get(`${rpcUrl}/net_info`);
        return data.result.peers || [];
    } catch (err) {
        return [];
    }
}

function parseRpcAddress (rpcAddress) {
    const [protocol, host, RpcPort] = rpcAddress.split(":");
    const RpcIsOpen = protocol === "tcp" && (host === "//0.0.0.0" || host === "//127.0.0.1");
    return { RpcIsOpen, RpcPort };
}

function isMatchingChain (peer, chainId) {
    return peer.node_info.network === chainId;
}

function createPeerInfo (peer, RpcPort) {
    return {
        Id: peer.node_info.id,
        Moniker: peer.node_info.moniker,
        RpcIsOpen: true,
        Rpc: `http://${peer.remote_ip}:${RpcPort}`,
        TxIndexIsOpen: peer.node_info.other.tx_index === "on",
    };
}

async function getPeersRpcInfo (chainId, rpcUrl) {
    const peers = await getPeers(rpcUrl);

    return peers
        .filter((peer) => isMatchingChain(peer, chainId) && parseRpcAddress(peer.node_info.other.rpc_address))
        .map((peer) => {
            const { RpcIsOpen, RpcPort } = parseRpcAddress(peer.node_info.other.rpc_address);
            return RpcIsOpen && RpcPort && peer.remote_ip.split(":").length === 1
                ? createPeerInfo(peer, RpcPort)
                : null;
        })
        .filter(Boolean);
}

async function getRpcStatus (rpcInfo) {
    try {
        const { data } = await axios.get(`${rpcInfo.Rpc}/status`, { timeout: 10000 });
        const catchingUp = data.result.sync_info.catching_up;

        if (!catchingUp) {
            rpcInfo.latestBlockHeight = data.result.sync_info.latest_block_height;
            rpcInfo.latestBlockTime = data.result.sync_info.latest_block_time;
            rpcInfo.chainId = data.result.node_info.network;
        }

        return rpcInfo;
    } catch (err) {
        return null;
    }
}

async function getAvailableRpcs (rpcUrl) {
    let availableRpcs = [];
    const nodeStatus = await getRpcStatus({ Rpc: rpcUrl });
    if (nodeStatus) {
        const chainId = nodeStatus.chainId;
        const latestBlockHeight = nodeStatus.latestBlockHeight;
        const rpcsInfo = await getPeersRpcInfo(chainId, rpcUrl);

        const results = await Promise.all(
            rpcsInfo
                .filter((rpc) => rpc.TxIndexIsOpen)
                .map((rpc) => getRpcStatus(rpc))
        );

        for (const result of results) {
            if (result && result.latestBlockHeight >= latestBlockHeight) {
                availableRpcs.push(result.Rpc);
            }
        }
    }
    return availableRpcs;
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function findOpenRpcs (rpcUrl) {
    let rpcUrls = [];
    rpcUrls = await getAvailableRpcs(rpcUrl);
    while (rpcUrls.length < 2) {
        console.log(`Not enough RPC URLs from ${rpcUrl}. Try again in 3 seconds...`)
        await sleep(3000);
        rpcUrls = await getAvailableRpcs(rpcUrl);
    }

    return rpcUrls;
}

const rpcEndpoints = await findOpenRpcs('https://rpc.cosmos.directory/cosmoshub');
console.log(`Available RPC endpoints: ${rpcEndpoints}`);