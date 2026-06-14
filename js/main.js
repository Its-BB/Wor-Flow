const APP_NAME = 'Wor Flow';
const APP_VERSION = '1.0.0';
const SETTINGS_KEY = 'worflow-settings';
const CUSTOM_PRESETS_KEY = 'worflow-custom-presets';
const ONBOARDING_KEY = 'worflow-onboarding-opted-out';
const DEFAULT_SETTINGS = {
    accentColor: '#d4a853',
    animationSpeed: '1',
    autoSave: true
};

let csInterface = null;
let currentFolderPath = '';
let currentOnboardingStep = 1;
let rainbowModeActive = false;
let rainbowInterval = null;
let currentAudioPlayer = null;
let assetManagerReady = false;
let graphPresetsReady = false;
let assetViewMode = 'grid';

const EOA_MAP = {
    'precompose': 'precomposeSelectedLayers()',
    'create-null': 'createNullObject()',
    'create-solid': 'createSolidLayer()',
    'create-adjustment': 'createAdjustmentLayer()',
    'create-camera': 'createCamera()',
    'create-light': 'createLight()',
    'time-remapping': 'enableTimeRemapping()',
    'reverse-time': 'reverseLayerTime()',
    'freeze-frame': 'freezeFrame()',
    'speed-120': 'adjustLayerSpeed(120)',
    'speed-150': 'adjustLayerSpeed(150)',
    'speed-200': 'adjustLayerSpeed(200)',
    'speed-50': 'adjustLayerSpeed(50)',
    'trim-comp': 'trimCompToWorkArea()',
    'center-anchor': 'centerAnchorPoint()',
    'fit-to-comp': 'fitLayerToComp()',
    'duplicate-layer': 'duplicateSelectedLayers()',
    'split-layer': 'splitLayerAtCurrentTime()',
    'sequence-layers': 'sequenceLayers()'
};

function $(id) {
    return document.getElementById(id);
}

function escapePath(path) {
    return String(path || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function getDocumentsPath() {
    const res = await evalScript('getSystemInfo()');
    if (res.success && res.data?.documentsPath) return res.data.documentsPath;
    return '';
}

function presetExistsInGrid(grid, name) {
    return Array.from(grid.querySelectorAll('h4')).some((h) => h.textContent.trim() === name);
}

async function copyFileToAssets(sourcePath, subPath = '') {
    const script = `(function(){
        try {
            var r = JSON.parse(WorFlow.createUserFolder());
            if (!r.success) return WorFlow.stringifyJSON(r);
            var base = r.data.mainFolder + "/Assets";
            var sub = "${escapePath(subPath)}";
            if (sub) base = base + "/" + sub.replace(/\\//g, "\\\\");
            var folder = new Folder(base);
            if (!folder.exists) folder.create();
            var src = new File("${escapePath(sourcePath)}");
            if (!src.exists) return WorFlow.stringifyJSON({ success: false, error: "Source file not found" });
            var dest = new File(folder.fsName + "/" + src.name);
            if (src.copy(dest)) return WorFlow.stringifyJSON({ success: true, message: "Copied " + src.name });
            return WorFlow.stringifyJSON({ success: false, error: "Copy failed" });
        } catch (e) {
            return WorFlow.stringifyJSON({ success: false, error: e.toString() });
        }
    })()`;
    return evalScript(script);
}

function evalScript(script) {
    return new Promise((resolve) => {
        if (!csInterface) {
            resolve({ success: false, error: 'Not in After Effects' });
            return;
        }
        csInterface.evalScript(script, (result) => {
            try {
                resolve(typeof result === 'string' ? JSON.parse(result) : result);
            } catch (e) {
                resolve({ success: false, error: 'Bad JSX response', raw: result });
            }
        });
    });
}

function updateStatus(message, type = 'info') {
    const el = $('status-message');
    if (!el) return;
    const text = el.querySelector('span:last-child');
    const dot = el.querySelector('.status-dot');
    if (text) text.textContent = message;
    if (dot) {
        dot.className = 'status-dot';
        if (type === 'success') dot.classList.add('ok');
        else if (type === 'warning') dot.classList.add('warn');
        else if (type === 'error') dot.classList.add('err');
        else dot.classList.add('info');
    }
    if (type !== 'error') {
        clearTimeout(updateStatus._timer);
        updateStatus._timer = setTimeout(() => {
            if (text && text.textContent === message) {
                text.textContent = 'Ready';
                if (dot) dot.className = 'status-dot';
            }
        }, 4000);
    }
}

function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-header"><span class="toast-title">${title}</span><button type="button" class="toast-close">&times;</button></div><div class="toast-message">${message}</div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const close = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
    };
    toast.querySelector('.toast-close').addEventListener('click', close);
    setTimeout(close, 4500);
}

async function initCSInterface() {
    try {
        if (window.cep && typeof CSInterface !== 'undefined') {
            csInterface = new CSInterface();
        }
    } catch (e) {
        csInterface = null;
    }
}

async function initAfterEffects() {
    if (!csInterface) {
        updateStatus('Browser preview mode', 'warning');
        return;
    }
    try {
        const host = csInterface.getHostEnvironment();
        if (!host || host.appId !== 'AEFT') {
            updateStatus('Open After Effects first', 'warning');
            return;
        }
    } catch (e) {
        updateStatus('AE connection unknown', 'warning');
    }
    updateStatus('Connected to After Effects', 'success');
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-link').forEach((link) => {
        link.classList.toggle('active', link.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach((tab) => {
        tab.classList.toggle('active', tab.id === tabName);
    });
    if (tabName === 'assets') setTimeout(initAssetManager, 100);
    if (tabName === 'sfx') setTimeout(loadSFXLibrary, 100);
    if (tabName === 'graph') setTimeout(initGraphPresets, 50);
    if (tabName === 'settings') setTimeout(refreshSettingsPanel, 50);
    updateStatus(`Opened ${tabName}`, 'info');
}

function bindNavigation() {
    document.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });
    document.querySelectorAll('.preset-subtab').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-subtab').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.preset-subtab-content').forEach((c) => c.classList.remove('active'));
            const target = $(btn.dataset.subtab);
            if (target) target.classList.add('active');
        });
    });
    $('import-preset-btn')?.addEventListener('click', importPresetFile);
}

function bindPreviewSliders() {
    document.querySelectorAll('.slider-handle').forEach((slider) => {
        const update = () => {
            const wrap = slider.closest('.preset-preview-slider');
            const after = wrap?.querySelector('.preview-after');
            if (after) after.style.clipPath = `inset(0 ${100 - slider.value}% 0 0)`;
        };
        slider.addEventListener('input', update);
        update();
    });
}

function bindPresetCards() {
    document.querySelectorAll('.preset-card').forEach((card) => {
        const name = card.querySelector('h4')?.textContent?.trim();
        const btn = card.querySelector('.btn-apply');
        if (btn && name) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                applyPresetFromCard(card, name);
            });
        }
        const previewSrc = card.dataset.preview;
        if (previewSrc) {
            const preview = card.querySelector('.preset-preview');
            const img = preview?.querySelector('.preview-image');
            if (!preview) return;
            const video = document.createElement('video');
            video.src = previewSrc;
            video.muted = true;
            video.loop = true;
            video.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .25s';
            preview.appendChild(video);
            card.addEventListener('mouseenter', () => {
                if (img) img.style.opacity = '0';
                video.style.opacity = '1';
                video.play().catch(() => {});
            });
            card.addEventListener('mouseleave', () => {
                if (img) img.style.opacity = '1';
                video.style.opacity = '0';
                video.pause();
                video.currentTime = 0;
            });
        }
    });
}

async function applyPresetFromCard(card, name) {
    if (!csInterface) {
        updateStatus('Open in After Effects to apply presets', 'error');
        return;
    }
    updateStatus(`Applying ${name}...`, 'loading');
    let script;
    if (card.dataset.ffx) {
        script = `applyBuiltInFFX("${card.dataset.ffx}")`;
    } else if (card.dataset.ae) {
        script = card.dataset.ae.endsWith('()') ? card.dataset.ae : `${card.dataset.ae}()`;
    } else {
        updateStatus(`Unknown preset: ${name}`, 'error');
        return;
    }
    const res = await evalScript(script);
    updateStatus(res.success ? res.message || `${name} applied` : res.error || 'Failed', res.success ? 'success' : 'error');
}

async function applyVisualEffect(name) {
    const card = Array.from(document.querySelectorAll('.preset-card')).find(
        (c) => c.querySelector('h4')?.textContent?.trim() === name
    );
    if (card) await applyPresetFromCard(card, name);
    else updateStatus(`Unknown preset: ${name}`, 'error');
}

function importPresetFile() {
    let input = $('preset-import-input');
    if (!input) {
        input = document.createElement('input');
        input.id = 'preset-import-input';
        input.type = 'file';
        input.accept = '.ffx';
        input.multiple = true;
        input.hidden = true;
        input.addEventListener('change', onPresetImport);
        document.body.appendChild(input);
    }
    input.value = '';
    input.click();
}

function onPresetImport(e) {
    Array.from(e.target.files || []).forEach((file) => addCustomPreset(file));
}

async function addCustomPreset(file) {
    const name = file.name.replace(/\.ffx$/i, '');
    const grid = $('custom-presets-grid');
    if (!grid) return;
    const empty = grid.querySelector('.empty-note');
    if (empty) empty.remove();

    const card = document.createElement('div');
    card.className = 'preset-card';
    card.dataset.ffx = `${name}.ffx`;
    card.innerHTML = `<button type="button" class="btn-delete" title="Remove">×</button><div class="preset-preview">★</div><div class="preset-info"><h4>${name}</h4><p>FFX preset</p><button type="button" class="btn-apply">Apply</button></div>`;
    card.querySelector('.btn-apply').addEventListener('click', () => {
        evalScript(`applyFFXPreset("${name}", "")`).then((res) => {
            updateStatus(res.success ? `Applied ${name}` : res.error || 'Failed', res.success ? 'success' : 'error');
        });
    });
    card.querySelector('.btn-delete').addEventListener('click', () => {
        card.remove();
        syncCustomPresetCount();
        let list = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]');
        list = list.filter((p) => p.name !== name);
        localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
        evalScript(`deleteFFXPreset("${name}")`);
    });
    grid.appendChild(card);
    syncCustomPresetCount();

    const list = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]');
    if (!list.find((p) => p.name === name)) {
        list.push({ name, type: 'ffx' });
        localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
    }
    if (file.path) {
        await evalScript(`copyFFXPreset("${escapePath(file.path)}", "${name}")`);
    } else if (csInterface) {
        await importPresetViaDialog(name);
    }
    updateStatus(`Imported ${name}`, 'success');
}

async function importPresetViaDialog(presetName) {
    const res = await evalScript('WorFlow.selectFilesToImport()');
    if (res.success && res.files?.length) {
        const match = res.files.find((f) => f.toLowerCase().endsWith('.ffx')) || res.files[0];
        await evalScript(`copyFFXPreset("${escapePath(match)}", "${presetName}")`);
    }
}

function syncCustomPresetCount() {
    const grid = $('custom-presets-grid');
    const countEl = $('custom-preset-count');
    if (!grid || !countEl) return;
    const n = grid.querySelectorAll('.preset-card').length;
    countEl.textContent = `${n} preset${n === 1 ? '' : 's'}`;
    if (n === 0) {
        grid.innerHTML = '<p class="empty-note">No custom presets yet. Hit Import Preset to add FFX files.</p>';
    }
}

function loadCustomPresetsFromStorage() {
    const list = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]');
    list.forEach((p) => {
        if (p.name) {
            const grid = $('custom-presets-grid');
            if (!grid || presetExistsInGrid(grid, p.name)) return;
            const card = document.createElement('div');
            card.className = 'preset-card';
            card.dataset.ffx = `${p.name}.ffx`;
            card.innerHTML = `<button type="button" class="btn-delete" title="Remove">×</button><div class="preset-preview">★</div><div class="preset-info"><h4>${p.name}</h4><p>FFX preset</p><button type="button" class="btn-apply">Apply</button></div>`;
            card.querySelector('.btn-apply').addEventListener('click', () => {
                evalScript(`applyFFXPreset("${p.name}", "")`).then((res) => {
                    updateStatus(res.success ? `Applied ${p.name}` : res.error || 'Failed', res.success ? 'success' : 'error');
                });
            });
            card.querySelector('.btn-delete').addEventListener('click', () => {
                card.remove();
                syncCustomPresetCount();
                let stored = JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]');
                stored = stored.filter((item) => item.name !== p.name);
                localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(stored));
                evalScript(`deleteFFXPreset("${p.name}")`);
            });
            const empty = grid.querySelector('.empty-note');
            if (empty) empty.remove();
            grid.appendChild(card);
        }
    });
    syncCustomPresetCount();
}

function bindEOA() {
    document.querySelectorAll('.eoa-btn').forEach((btn) => {
        btn.addEventListener('click', () => runEOA(btn.dataset.action));
    });
}

async function runEOA(action) {
    if (!csInterface) {
        updateStatus('After Effects required', 'error');
        return;
    }
    let script = EOA_MAP[action];
    if (action === 'speed-custom') {
        const val = prompt('Speed % (e.g. 100):', '100');
        if (!val) return;
        script = `adjustLayerSpeed(${parseInt(val, 10)})`;
    }
    if (!script) return;
    updateStatus('Running...', 'loading');
    const res = await evalScript(script);
    updateStatus(res.success ? res.message || 'Done' : res.error || 'Failed', res.success ? 'success' : 'error');
}

function initGraphPresets() {
    document.querySelectorAll('.graph-preset-card').forEach((card) => {
        const canvas = card.querySelector('.graph-preset-canvas');
        const preset = card.dataset.preset;
        if (canvas && preset) drawGraphCurve(canvas, preset);
        if (!graphPresetsReady) {
            card.addEventListener('click', () => {
                document.querySelectorAll('.graph-preset-card').forEach((c) => c.classList.remove('active'));
                card.classList.add('active');
                applyGraphPreset(preset);
            });
        }
    });
    graphPresetsReady = true;
}

function drawGraphCurve(canvas, preset) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d4a853';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#141412';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2e2e2c';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
        const gy = 8 + (g / 4) * (h - 16);
        ctx.beginPath();
        ctx.moveTo(8, gy);
        ctx.lineTo(w - 8, gy);
        ctx.stroke();
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        let y = t;
        if (preset === 'ease-in' || preset === 'quad-in') y = t * t;
        else if (preset === 'ease-out' || preset === 'quad-out') y = t * (2 - t);
        else if (preset === 'ease-in-out' || preset === 'smooth') y = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        else if (preset === 'expo-in') y = t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
        else if (preset === 'expo-out') y = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        else if (preset === 'cubic-in') y = t * t * t;
        else if (preset === 'cubic-out') { const u = t - 1; y = u * u * u + 1; }
        const x = 8 + t * (w - 16);
        const py = h - 8 - y * (h - 16);
        i === 0 ? ctx.moveTo(x, py) : ctx.lineTo(x, py);
    }
    ctx.stroke();
}

function redrawAllGraphCurves() {
    document.querySelectorAll('.graph-preset-card').forEach((card) => {
        const canvas = card.querySelector('.graph-preset-canvas');
        const preset = card.dataset.preset;
        if (canvas && preset) drawGraphCurve(canvas, preset);
    });
}

async function applyGraphPreset(preset) {
    updateStatus(`Applying ${preset}...`, 'loading');
    const res = await evalScript(`applyGraphPreset("${preset}")`);
    updateStatus(res.success ? res.message || 'Curve applied' : res.error || 'Failed', res.success ? 'success' : 'error');
}

async function loadSFXLibrary() {
    const container = $('sfx-container');
    if (!container) return;
    container.innerHTML = '<div class="sfx-loading">Loading sound effects...</div>';
    if (!csInterface) {
        container.innerHTML = '<div class="sfx-empty-state"><p>Open in After Effects to load SFX</p></div>';
        return;
    }
    let sfxScript = 'scanSFXFolder()';
    try {
        if (typeof SystemPath !== 'undefined') {
            const extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
            if (extPath) {
                await evalScript('setExtensionRoot("' + escapePath(extPath) + '")');
                const sfxPath = extPath.replace(/\\/g, '/') + '/sfx';
                sfxScript = 'scanSFXFolder("' + escapePath(sfxPath) + '")';
            }
        }
    } catch (e) {}
    const res = await evalScript(sfxScript);
    if (!res.success) {
        const detail = res.error || res.raw || 'SFX folder not found';
        container.innerHTML = `<div class="sfx-empty-state"><p>${detail}</p></div>`;
        return;
    }
    if (!res.categories?.length) {
        container.innerHTML = '<div class="sfx-empty-state"><p>No sound effects found in the sfx folder</p></div>';
        return;
    }
    renderSFXCategories(res.categories);
}

function renderSFXCategories(categories) {
    const container = $('sfx-container');
    container.innerHTML = '';
    categories.forEach((cat) => {
        const block = document.createElement('div');
        block.className = 'sfx-category';
        block.innerHTML = `<div class="sfx-category-header"><button type="button" class="sfx-category-toggle"><span class="sfx-category-name">${cat.name}</span><span class="sfx-category-count">${cat.count} sounds</span></button></div><div class="sfx-sounds-list"></div>`;
        const list = block.querySelector('.sfx-sounds-list');
        cat.sounds.forEach((sound) => {
            const row = document.createElement('div');
            row.className = 'sfx-item';
            const displayName = sound.name.replace(/\.(wav|mp3|m4a)$/i, '');
            row.innerHTML = `<div class="sfx-item-info"><span class="sfx-item-name">${displayName}</span><span class="sfx-item-size">${(sound.size / 1024 / 1024).toFixed(2)} MB</span></div><div class="sfx-item-controls"><button type="button" class="sfx-play-btn">Play</button><button type="button" class="sfx-apply-btn">Apply</button></div>`;
            row.querySelector('.sfx-play-btn').addEventListener('click', () => previewSFX(sound.path, row.querySelector('.sfx-play-btn')));
            row.querySelector('.sfx-apply-btn').addEventListener('click', () => applySFX(sound.path, displayName));
            list.appendChild(row);
        });
        block.querySelector('.sfx-category-toggle').addEventListener('click', () => list.classList.toggle('collapsed'));
        container.appendChild(block);
    });
}

function previewSFX(filePath, btn) {
    if (currentAudioPlayer) {
        currentAudioPlayer.pause();
        currentAudioPlayer = null;
        document.querySelectorAll('.sfx-play-btn').forEach((b) => { b.textContent = 'Play'; });
    }
    if (btn.textContent === 'Stop') {
        btn.textContent = 'Play';
        return;
    }
    const audio = new Audio('file:///' + filePath.replace(/\\/g, '/'));
    currentAudioPlayer = audio;
    btn.textContent = 'Stop';
    audio.play().catch(() => {});
    audio.onended = () => { btn.textContent = 'Play'; currentAudioPlayer = null; };
}

async function applySFX(filePath, name) {
    const res = await evalScript(`importAsset("${escapePath(filePath)}")`);
    updateStatus(res.success ? `Imported ${name}` : res.error || 'Failed', res.success ? 'success' : 'error');
}

function bindSFXControls() {
    $('refresh-sfx-btn')?.addEventListener('click', loadSFXLibrary);
    $('sfx-search')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.sfx-item').forEach((item) => {
            const name = item.querySelector('.sfx-item-name')?.textContent?.toLowerCase() || '';
            item.style.display = name.includes(q) ? '' : 'none';
        });
    });
}

async function initAssetManager() {
    if (!assetManagerReady) {
        bindAssetControls();
        assetManagerReady = true;
    }
    await loadAssets(currentFolderPath);
}

function bindAssetControls() {
    const upload = $('asset-upload-area');
    const input = $('asset-file-input');
    upload?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', (e) => uploadAssetFiles(Array.from(e.target.files || [])));
    upload?.addEventListener('dragover', (e) => { e.preventDefault(); upload.classList.add('dragover'); });
    upload?.addEventListener('dragleave', () => upload.classList.remove('dragover'));
    upload?.addEventListener('drop', (e) => {
        e.preventDefault();
        upload.classList.remove('dragover');
        uploadAssetFiles(Array.from(e.dataTransfer.files || []));
    });
    $('browse-files-btn')?.addEventListener('click', browseAssetFiles);
    $('create-folder-btn')?.addEventListener('click', createAssetFolder);
    $('refresh-assets-btn')?.addEventListener('click', () => loadAssets(currentFolderPath));
    document.querySelectorAll('.view-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            assetViewMode = btn.dataset.view || 'grid';
            const grid = $('asset-grid');
            if (grid) grid.classList.toggle('list-view', assetViewMode === 'list');
        });
    });
}

function updateAssetBreadcrumb(folderPath) {
    const pathEl = document.querySelector('.asset-path');
    if (!pathEl) return;
    const parts = folderPath ? folderPath.split('/').filter(Boolean) : [];
    let html = '<span class="path-item' + (parts.length ? '' : ' active') + '" data-path="">Assets</span>';
    let built = '';
    parts.forEach((part, i) => {
        built += (built ? '/' : '') + part;
        const isLast = i === parts.length - 1;
        html += '<span class="path-separator">/</span>';
        html += `<span class="path-item${isLast ? ' active' : ''}" data-path="${built}">${part}</span>`;
    });
    pathEl.innerHTML = html;
    pathEl.querySelectorAll('.path-item').forEach((item) => {
        item.addEventListener('click', () => loadAssets(item.dataset.path || ''));
    });
}

async function loadAssets(folderPath = '') {
    currentFolderPath = folderPath;
    updateAssetBreadcrumb(folderPath);
    const grid = $('asset-grid');
    if (!grid) return;
    grid.classList.toggle('list-view', assetViewMode === 'list');
    grid.innerHTML = '<div class="sfx-loading">Loading assets...</div>';
    const res = await evalScript(`WorFlow.scanAssetsFolder("${escapePath(folderPath)}")`);
    const assets = res.data?.assets || res.assets || [];
    if (!res.success || !assets.length) {
        grid.innerHTML = '<div class="no-assets-message"><p>No assets found. Drop files or browse to import.</p></div>';
        return;
    }
    grid.innerHTML = '';
    if (folderPath) {
        const back = document.createElement('div');
        back.className = 'asset-card folder-card';
        back.innerHTML = '<div class="asset-thumbnail">←</div><div class="asset-info"><h4>..</h4></div>';
        back.addEventListener('click', () => {
            const parts = folderPath.split('/');
            parts.pop();
            loadAssets(parts.join('/'));
        });
        grid.appendChild(back);
    }
    assets.forEach((asset) => {
        const isFolder = asset.isFolder || asset.type === 'folder';
        const card = document.createElement('div');
        card.className = `asset-card${isFolder ? ' folder-card' : ''}`;
        card.innerHTML = `<div class="asset-thumbnail">${isFolder ? '📁' : '📄'}</div><div class="asset-info"><h4>${asset.name}</h4></div>`;
        card.addEventListener('click', () => {
            if (isFolder) loadAssets(folderPath ? `${folderPath}/${asset.name}` : asset.name);
            else importAssetPath(asset.path);
        });
        grid.appendChild(card);
    });
}

async function importAssetPath(path) {
    const res = await evalScript(`importAsset("${escapePath(path)}")`);
    updateStatus(res.success ? 'Asset imported to project' : res.error || 'Import failed', res.success ? 'success' : 'error');
}

async function uploadAssetFiles(files) {
    for (const file of files) {
        await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const base64 = btoa(ev.target.result);
                await evalScript(`copyAssetToFolder("${file.name}", "${base64}", "${escapePath(currentFolderPath)}")`);
                resolve();
            };
            reader.readAsBinaryString(file);
        });
    }
    await loadAssets(currentFolderPath);
    updateStatus('Files uploaded', 'success');
}

async function browseAssetFiles() {
    const res = await evalScript('WorFlow.selectFilesToImport()');
    if (res.success && res.files) {
        for (const f of res.files) {
            await copyFileToAssets(f, currentFolderPath);
        }
        await loadAssets(currentFolderPath);
        updateStatus('Files added to assets', 'success');
    }
}

async function createAssetFolder() {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;
    const res = await evalScript(`WorFlow.createFolder("${name.trim()}", "${escapePath(currentFolderPath)}")`);
    updateStatus(res.success ? 'Folder created' : res.error || 'Failed', res.success ? 'success' : 'error');
    if (res.success) await loadAssets(currentFolderPath);
}

function mergeSettings(stored) {
    return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

function getSettingsFromUI() {
    return {
        accentColor: $('accent-color')?.value || DEFAULT_SETTINGS.accentColor,
        animationSpeed: $('animation-speed')?.value || DEFAULT_SETTINGS.animationSpeed,
        autoSave: $('auto-save-settings')?.checked ?? DEFAULT_SETTINGS.autoSave
    };
}

function hexToRgba(hex, alpha) {
    const h = String(hex || '').replace('#', '');
    if (h.length < 6) return `rgba(212, 168, 83, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function accentSoft(color) {
    if (String(color).startsWith('hsl(')) {
        return String(color).replace('hsl(', 'hsla(').replace(')', ', 0.14)');
    }
    return hexToRgba(color, 0.14);
}

function applyAccentColor(color) {
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-hover', color);
    document.documentElement.style.setProperty('--accent-soft', accentSoft(color));
    redrawAllGraphCurves();
}

function applyAnimationSpeed(speed) {
    const n = parseFloat(speed) || 1;
    document.documentElement.style.setProperty('--dur', `${0.12 * n}s`);
    const label = $('animation-speed-label');
    if (label) label.textContent = `${n.toFixed(1)}×`;
}

function updateAccentSwatches(color) {
    const normalized = String(color || '').toLowerCase();
    document.querySelectorAll('.accent-swatch').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.color?.toLowerCase() === normalized);
    });
}

function setSettingsStatus(text, dirty = false, error = false) {
    const el = $('storage-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('is-dirty', dirty);
    el.classList.toggle('is-error', error);
}

function applySettingsToUI(settings) {
    const merged = mergeSettings(settings);
    if ($('accent-color')) $('accent-color').value = merged.accentColor;
    if ($('animation-speed')) $('animation-speed').value = merged.animationSpeed;
    if ($('auto-save-settings')) $('auto-save-settings').checked = merged.autoSave !== false;
    applyAccentColor(merged.accentColor);
    applyAnimationSpeed(merged.animationSpeed);
    updateAccentSwatches(merged.accentColor);
}

function stopRainbowMode() {
    if (!rainbowModeActive) return;
    clearInterval(rainbowInterval);
    rainbowInterval = null;
    rainbowModeActive = false;
    $('rainbow-mode-btn')?.classList.remove('active');
    applyAccentColor($('accent-color')?.value || DEFAULT_SETTINGS.accentColor);
    updateAccentSwatches($('accent-color')?.value);
}

let settingsSaveTimer = null;

function schedulePersistSettings() {
    clearTimeout(settingsSaveTimer);
    settingsSaveTimer = setTimeout(() => persistSettings(), 350);
}

async function persistSettings(force = false) {
    const autoSave = $('auto-save-settings')?.checked ?? true;
    if (!force && !autoSave) {
        setSettingsStatus('Unsaved changes', true);
        return;
    }
    const settings = getSettingsFromUI();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    let ok = true;
    if (csInterface) {
        const res = await evalScript(`savePreferences(${JSON.stringify(JSON.stringify(settings))})`);
        ok = res && res.success === true;
    }
    setSettingsStatus(ok ? 'Saved' : 'Save failed', false, !ok);
    return ok;
}

async function refreshSettingsPanel() {
    const statusEl = $('settings-ae-status');
    const versionEl = $('settings-ae-version');
    const pathEl = $('worflow-folder-path');

    if (!csInterface) {
        if (statusEl) {
            statusEl.textContent = 'Preview mode';
            statusEl.className = 'settings-kv-value is-warn';
        }
        if (versionEl) versionEl.textContent = 'Not in After Effects';
        return;
    }

    try {
        const host = csInterface.getHostEnvironment();
        if (host?.appId === 'AEFT') {
            if (statusEl) {
                statusEl.textContent = 'Connected';
                statusEl.className = 'settings-kv-value is-ok';
            }
            if (versionEl && host.appVersion) versionEl.textContent = host.appVersion;
        } else if (statusEl) {
            statusEl.textContent = 'Wrong host app';
            statusEl.className = 'settings-kv-value is-warn';
        }
    } catch (e) {
        if (statusEl) {
            statusEl.textContent = 'Unknown';
            statusEl.className = 'settings-kv-value is-warn';
        }
    }

    const info = await evalScript('getSystemInfo()');
    if (info.success && info.data) {
        if (versionEl && info.data.aeVersion) versionEl.textContent = info.data.aeVersion;
        if (pathEl && info.data.documentsPath) {
            pathEl.textContent = `${info.data.documentsPath}\\WorFlow`;
        }
    }
}

function bindSettings() {
    document.querySelectorAll('.accent-swatch').forEach((btn) => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            if (!color) return;
            stopRainbowMode();
            if ($('accent-color')) $('accent-color').value = color;
            applyAccentColor(color);
            updateAccentSwatches(color);
            schedulePersistSettings();
        });
    });

    $('accent-color')?.addEventListener('input', (e) => {
        stopRainbowMode();
        applyAccentColor(e.target.value);
        updateAccentSwatches(e.target.value);
        schedulePersistSettings();
    });

    $('animation-speed')?.addEventListener('input', (e) => {
        applyAnimationSpeed(e.target.value);
        schedulePersistSettings();
    });

    $('auto-save-settings')?.addEventListener('change', () => {
        if ($('auto-save-settings')?.checked) persistSettings(true);
        else setSettingsStatus('Unsaved changes', true);
    });

    $('save-settings-btn')?.addEventListener('click', saveSettings);
    $('reset-settings-btn')?.addEventListener('click', resetSettings);
    $('export-settings-btn')?.addEventListener('click', exportSettings);
    $('import-settings-btn')?.addEventListener('click', () => $('settings-import-input')?.click());
    $('settings-import-input')?.addEventListener('change', importSettingsFile);
    $('open-worflow-folder-btn')?.addEventListener('click', openWorFlowFolder);
    $('rainbow-mode-btn')?.addEventListener('click', toggleRainbow);
    $('credits-btn')?.addEventListener('click', () => $('credits-overlay')?.classList.add('active'));
    $('credits-close-btn')?.addEventListener('click', () => $('credits-overlay')?.classList.remove('active'));
    $('credits-overlay')?.addEventListener('click', (e) => {
        if (e.target === $('credits-overlay')) $('credits-overlay').classList.remove('active');
    });
}

async function saveSettings() {
    const ok = await persistSettings(true);
    showToast('Settings', ok ? 'Saved' : 'Could not save to disk', ok ? 'success' : 'error');
}

async function resetSettings() {
    stopRainbowMode();
    localStorage.removeItem(SETTINGS_KEY);
    applySettingsToUI(DEFAULT_SETTINGS);
    await persistSettings(true);
    showToast('Settings', 'Reset to defaults', 'info');
}

function exportSettings() {
    const data = JSON.stringify(getSettingsFromUI(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'worflow-settings.json';
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Settings', 'Exported', 'success');
}

async function importSettingsFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const data = mergeSettings(JSON.parse(await file.text()));
        stopRainbowMode();
        applySettingsToUI(data);
        await persistSettings(true);
        showToast('Settings', 'Imported', 'success');
    } catch (err) {
        showToast('Settings', 'Invalid settings file', 'error');
    }
    e.target.value = '';
}

async function openWorFlowFolder() {
    const folder = await evalScript('createUserFolder()');
    if (folder.success && folder.data?.mainFolder) {
        evalScript(`(new Folder("${escapePath(folder.data.mainFolder)}")).execute()`);
    } else {
        evalScript('var f = new Folder(Folder.myDocuments.fsName + "/WorFlow"); f.exists ? f.execute() : f.create() && f.execute()');
    }
}

function toggleRainbow() {
    if (rainbowModeActive) {
        stopRainbowMode();
        schedulePersistSettings();
        return;
    }
    rainbowModeActive = true;
    $('rainbow-mode-btn')?.classList.add('active');
    document.querySelectorAll('.accent-swatch').forEach((btn) => btn.classList.remove('active'));
    let hue = 0;
    rainbowInterval = setInterval(() => {
        hue = (hue + 3) % 360;
        applyAccentColor(`hsl(${hue}, 70%, 55%)`);
    }, 120);
}

function bindOnboarding() {
    $('onboarding-prev')?.addEventListener('click', () => {
        if (currentOnboardingStep > 1) { currentOnboardingStep--; refreshOnboarding(); }
    });
    $('onboarding-next')?.addEventListener('click', () => {
        if (currentOnboardingStep < 4) { currentOnboardingStep++; refreshOnboarding(); }
    });
    $('onboarding-finish')?.addEventListener('click', finishOnboarding);
    document.querySelectorAll('.onboarding-dots .dot').forEach((dot) => {
        dot.addEventListener('click', () => {
            currentOnboardingStep = parseInt(dot.dataset.step, 10);
            refreshOnboarding();
        });
    });
}

function refreshOnboarding() {
    document.querySelectorAll('.onboarding-step').forEach((step) => {
        step.classList.toggle('active', parseInt(step.dataset.step, 10) === currentOnboardingStep);
    });
    document.querySelectorAll('.onboarding-dots .dot').forEach((dot) => {
        dot.classList.toggle('active', parseInt(dot.dataset.step, 10) === currentOnboardingStep);
    });
    if ($('onboarding-prev')) $('onboarding-prev').disabled = currentOnboardingStep === 1;
    if ($('onboarding-next')) $('onboarding-next').style.display = currentOnboardingStep === 4 ? 'none' : '';
    if ($('onboarding-finish')) $('onboarding-finish').style.display = currentOnboardingStep === 4 ? 'inline-block' : 'none';
}

function showOnboarding() {
    $('onboarding-overlay')?.classList.add('active');
    currentOnboardingStep = 1;
    refreshOnboarding();
}

function finishOnboarding() {
    if ($('dont-show-again')?.checked) localStorage.setItem(ONBOARDING_KEY, 'true');
    $('onboarding-overlay')?.classList.remove('active');
}

function savePanelSize() {
    try {
        localStorage.setItem('worflow-panel-w', window.innerWidth);
        localStorage.setItem('worflow-panel-h', window.innerHeight);
    } catch (e) {}
}

function restorePanelSize() {
    if (!csInterface?.resizeContent) return;
    try {
        const w = parseInt(localStorage.getItem('worflow-panel-w'), 10);
        const h = parseInt(localStorage.getItem('worflow-panel-h'), 10);
        if (w && h) csInterface.resizeContent(w, h);
    } catch (e) {}
}

async function loadAllSettings() {
    let settings = { ...DEFAULT_SETTINGS };
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) settings = mergeSettings(JSON.parse(raw));
    } catch (e) {}

    if (csInterface && !localStorage.getItem(SETTINGS_KEY)) {
        const prefs = await evalScript('loadPreferences()');
        if (prefs.success && prefs.data) settings = mergeSettings(prefs.data);
    }

    applySettingsToUI(settings);
    setSettingsStatus('Saved');
}

async function boot() {
    await initCSInterface();
    restorePanelSize();
    window.addEventListener('resize', savePanelSize);
    bindNavigation();
    bindPreviewSliders();
    bindPresetCards();
    bindEOA();
    initGraphPresets();
    bindSFXControls();
    bindSettings();
    bindOnboarding();
    document.querySelector('.help-btn')?.addEventListener('click', showOnboarding);
    await initAfterEffects();
    await loadAllSettings();
    loadCustomPresetsFromStorage();
    if (localStorage.getItem(ONBOARDING_KEY) !== 'true') {
        setTimeout(showOnboarding, 800);
    }
    updateStatus('Ready', 'success');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}

window.WorFlow = {
    switchTab,
    updateStatus,
    showToast,
    applyVisualEffect,
    loadSFXLibrary,
    evalScript
};
