let provider;
let signer;

const ZENCHAIN_PARAMS = {
  chainId: "0x20d8",
  chainName: "ZenChain Testnet",
  nativeCurrency: { name: "ZenChain Token", symbol: "ZTC", decimals: 18 },
  rpcUrls: ["https://zenchain-testnet.api.onfinality.io/public"],
  blockExplorerUrls: ["https://zentrace.io/"]
};

// DOM helpers
const connectBtn = () => document.getElementById('connectBtn');
const statusEl = () => document.getElementById('status');
const addressEl = () => document.getElementById('walletAddress');
const balanceEl = () => document.getElementById('balance');
const walletInfoEl = () => document.getElementById('walletInfo');
const sendBtn = () => document.getElementById('sendBtn');
const toAddressInput = () => document.getElementById('toAddress');
const amountInput = () => document.getElementById('amount');
const txStatusEl = () => document.getElementById('txStatus');
const refreshBtn = () => document.getElementById('refreshBtn');
const viewTxBtn = () => document.getElementById('viewTxBtn');
const queryAddressInput = () => document.getElementById('queryAddress');
const txListEl = () => document.getElementById('txList');

function setStatus(text){ statusEl().innerText = text }

async function ensureProvider(){
  if (!window.ethereum) throw new Error('MetaMask not detected');
  provider = new window.ethers.providers.Web3Provider(window.ethereum, 'any');
  signer = provider.getSigner();
}

async function switchToZenChain(){
  const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (currentChainId !== ZENCHAIN_PARAMS.chainId) {
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ZENCHAIN_PARAMS.chainId }] });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [ZENCHAIN_PARAMS] });
      } else throw err;
    }
  }
}

async function refreshBalanceAndInfo(){
  try{
    const address = await signer.getAddress();
    const balance = await provider.getBalance(address);
    addressEl().innerText = address;
    balanceEl().innerText = window.ethers.utils.formatEther(balance) + ' ZTC';
    walletInfoEl().classList.remove('hidden');
  }catch(e){console.error(e)}
}

async function connectWallet(){
  try{
    setStatus('Connecting...');
    if (!window.ethereum) { setStatus('MetaMask not found'); alert('Please Install MetaMask'); return }
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await ensureProvider();
    await switchToZenChain();
    await refreshBalanceAndInfo();
    setStatus('✅ Connected');
    sendBtn().disabled = false;
  }catch(err){ console.error(err); setStatus('Connection error'); alert(err.message || err) }
}

async function sendNativeToken(){
  const to = toAddressInput().value.trim();
  const amount = amountInput().value.trim();
  txStatusEl().innerText = '';
  if (!window.ethereum) return alert('MetaMask not found');
  if (!window.ethers.utils.isAddress(to)) return alert('The address is invalid.');
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return alert('The value is invalid.');

  try{
    const value = window.ethers.utils.parseEther(amount);
    const txResponse = await signer.sendTransaction({ to, value });
    txStatusEl().innerHTML = `Tx sent: <a href="${ZENCHAIN_PARAMS.blockExplorerUrls["https://zentrace.io/"]}/tx/${txResponse.hash}" target="_blank">${txResponse.hash}</a> (pending)`;

    const receipt = await txResponse.wait(1);
    txStatusEl().innerHTML = `✅ Confirmed: <a href="${ZENCHAIN_PARAMS.blockExplorerUrls["https://zentrace.io/"]}/tx/${receipt.transactionHash}" target="_blank">${receipt.transactionHash}</a> (block ${receipt.blockNumber})`;
    await refreshBalanceAndInfo();
  }catch(err){ console.error(err); alert('Error sending transaction'+(err.message||err)) }
}

async function fetchHistoryFor(address){
  txListEl().innerHTML = 'Loading...';
  try{
    const history = await provider.getHistory(address);
    if (!history || history.length === 0){
      txListEl().innerHTML = '<div class="tx-item">No transactions found (or RPC does not provide history)</div>';
      return;
    }
    const slice = history.slice(-20).reverse();
    txListEl().innerHTML = '';
    slice.forEach(t => {
      const item = document.createElement('div'); item.className='tx-item';
      const from = t.from || '—';
      const to = t.to || '—';
      const value = window.ethers.utils.formatEther(t.value || '0');
      const time = t.timestamp ? new Date(t.timestamp*1000).toLocaleString() : 'N/A';
      item.innerHTML = `<div><strong>Hash:</strong> <a href="${ZENCHAIN_PARAMS.blockExplorerUrls[0]}/tx/${t.hash}" target="_blank">${t.hash}</a></div>
                        <div class="meta">${time} — from ${from} → to ${to} — ${value} ZTC</div>`;
      txListEl().appendChild(item);
    });
  }catch(err){
    console.error(err);
    txListEl().innerHTML = '<div class="tx-item">Failed to fetch history from RPC. Use a block-explorer API.</div>';
  }
}

// UI wiring
window.addEventListener('DOMContentLoaded', ()=>{
  connectBtn().addEventListener('click', connectWallet);
  sendBtn().addEventListener('click', sendNativeToken);
  refreshBtn().addEventListener('click', async ()=>{ if(!signer) return alert('Connect first'); await refreshBalanceAndInfo(); });
  viewTxBtn().addEventListener('click', async ()=>{
    try{
      if (!provider) await ensureProvider();
      let addr = queryAddressInput().value.trim();
      if (!addr){ 
        if (!signer) return alert('Connect, or enter the address');
        addr = await signer.getAddress();
      }
      if (!window.ethers.utils.isAddress(addr)) return alert('The address is invalid.');
      await fetchHistoryFor(addr);
    }catch(e){ console.error(e); alert(e.message||e) }
  });

  if (window.ethereum){
    window.ethereum.on('accountsChanged', async (accounts)=>{
      if (accounts.length===0){ setStatus('Not connected'); walletInfoEl().classList.add('hidden'); sendBtn().disabled=true } 
      else { await ensureProvider(); await refreshBalanceAndInfo(); setStatus('Connected'); sendBtn().disabled=false }
    });
    window.ethereum.on('chainChanged', async ()=>{ location.reload(); });
  }
});
