// ============================================
// TINY KV STORE PRO - ADVANCED JAVASCRIPT
// Version 2.0.0
// ============================================

// ============================================
// ENCRYPTION MODULE
// ============================================
const Crypto = {
    // Simple encryption for demo (in production, use Web Crypto API)
    encrypt(text, key = 'defaultKey') {
        let encrypted = '';
        for (let i = 0; i < text.length; i++) {
            encrypted += String.fromCharCode(
                text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return btoa(encrypted);
    },

    decrypt(encrypted, key = 'defaultKey') {
        try {
            const text = atob(encrypted);
            let decrypted = '';
            for (let i = 0; i < text.length; i++) {
                decrypted += String.fromCharCode(
                    text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return decrypted;
        } catch (e) {
            return null;
        }
    }
};

// ============================================
// COMPRESSION MODULE
// ============================================
const Compression = {
    compress(text) {
        // Simple Run-Length Encoding for demo
        return text.replace(/(.)\1+/g, (match, char) => {
            return match.length > 3 ? `${char}${match.length}` : match;
        });
    },

    decompress(compressed) {
        return compressed.replace(/(.)\d+/g, (match, char) => {
            const count = parseInt(match.slice(1));
            return char.repeat(count);
        });
    }
};

// ============================================
// ENHANCED KV STORE CLASS
// ============================================
class TinyKVStorePro {
    constructor() {
        this.store = new Map();
        this.wal = [];
        this.cache = new Map();
        this.cacheSize = 100;
        this.encryptedKeys = new Set();
        this.queryHistory = [];
        this.stats = {
            totalOps: 0,
            putOps: 0,
            getOps: 0,
            deleteOps: 0,
            cacheHits: 0,
            cacheMisses: 0,
            latencies: [],
            opsPerSecond: [],
            timestamps: []
        };
        this.monitoring = {
            enabled: true,
            interval: null
        };
        this.loadFromStorage();
        this.startMonitoring();
    }

    // ========================================
    // CORE OPERATIONS
    // ========================================
    
    put(key, value, options = {}) {
        const start = performance.now();
        
        if (!key || value === undefined) {
            throw new Error('Invalid key or value');
        }

        // Handle encryption
        let storedValue = value;
        if (options.encrypted) {
            storedValue = Crypto.encrypt(value);
            this.encryptedKeys.add(key);
        }

        // Handle compression
        if (options.compress && typeof storedValue === 'string') {
            storedValue = Compression.compress(storedValue);
        }

        // Write to WAL
        this.wal.push({
            timestamp: Date.now(),
            op: 'PUT',
            key,
            value: storedValue,
            options
        });

        // Create entry
        const entry = {
            value: storedValue,
            timestamp: Date.now(),
            encrypted: options.encrypted || false,
            compressed: options.compress || false
        };

        // Handle TTL
        if (options.ttl && options.ttl > 0) {
            entry.expiry = Date.now() + (options.ttl * 1000);
            setTimeout(() => this.delete(key), options.ttl * 1000);
        }

        this.store.set(key, entry);
        this.updateCache(key, entry);
        this.persist();

        const latency = performance.now() - start;
        this.recordStats('PUT', latency);

        return { success: true, latency: latency.toFixed(2) };
    }

    get(key) {
        const start = performance.now();
        this.stats.getOps++;

        // Check cache
        if (this.cache.has(key)) {
            this.stats.cacheHits++;
            const entry = this.cache.get(key);
            
            if (entry.expiry && entry.expiry < Date.now()) {
                this.delete(key);
                return null;
            }

            const latency = performance.now() - start;
            this.recordStats('GET', latency);
            
            return this.processValue(entry.value, entry);
        }

        // Cache miss
        this.stats.cacheMisses++;

        if (!this.store.has(key)) {
            const latency = performance.now() - start;
            this.recordStats('GET', latency);
            return null;
        }

        const entry = this.store.get(key);
        
        if (entry.expiry && entry.expiry < Date.now()) {
            this.delete(key);
            return null;
        }

        this.updateCache(key, entry);

        const latency = performance.now() - start;
        this.recordStats('GET', latency);
        
        return this.processValue(entry.value, entry);
    }

    delete(key) {
        const start = performance.now();
        
        this.wal.push({
            timestamp: Date.now(),
            op: 'DELETE',
            key
        });

        const existed = this.store.delete(key);
        this.cache.delete(key);
        this.encryptedKeys.delete(key);

        this.persist();

        const latency = performance.now() - start;
        this.recordStats('DELETE', latency);

        return { success: existed, latency: latency.toFixed(2) };
    }

    // ========================================
    // ADVANCED OPERATIONS
    // ========================================

    exists(key) {
        const entry = this.store.get(key);
        if (!entry) return false;
        if (entry.expiry && entry.expiry < Date.now()) {
            this.delete(key);
            return false;
        }
        return true;
    }

    keys(pattern = '*') {
        const keys = Array.from(this.store.keys());
        if (pattern === '*') return keys;
        
        // Convert glob pattern to regex
        const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
        );
        return keys.filter(k => regex.test(k));
    }

    scan(cursor = 0, options = {}) {
        const keys = Array.from(this.store.keys());
        const count = options.count || 10;
        const pattern = options.match || '*';
        
        const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
        );
        
        const filtered = keys.filter(k => regex.test(k));
        const result = filtered.slice(cursor, cursor + count);
        
        return {
            cursor: cursor + count < filtered.length ? cursor + count : 0,
            keys: result
        };
    }

    clear() {
        this.store.clear();
        this.cache.clear();
        this.encryptedKeys.clear();
        this.wal = [];
        this.queryHistory = [];
        this.persist();
        this.resetStats();
    }

    // ========================================
    // BATCH OPERATIONS
    // ========================================

    batch(operations) {
        const results = [];
        const startTime = performance.now();
        
        try {
            for (const op of operations) {
                let result;
                switch (op.op.toUpperCase()) {
                    case 'PUT':
                        result = this.put(op.key, op.value, { ttl: op.ttl });
                        break;
                    case 'GET':
                        result = { success: true, value: this.get(op.key) };
                        break;
                    case 'DELETE':
                        result = this.delete(op.key);
                        break;
                    case 'EXISTS':
                        result = { success: true, exists: this.exists(op.key) };
                        break;
                    default:
                        result = { success: false, error: 'Unknown operation' };
                }
                results.push({ ...op, result });
            }
            
            const totalTime = performance.now() - startTime;
            return {
                success: true,
                results,
                totalTime: totalTime.toFixed(2),
                opsPerformed: operations.length
            };
        } catch (e) {
            return {
                success: false,
                error: e.message,
                results
            };
        }
    }

    // ========================================
    // ENCRYPTION OPERATIONS
    // ========================================

    putEncrypted(key, value, ttl = null) {
        return this.put(key, value, { encrypted: true, ttl });
    }

    getDecrypted(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        
        if (entry.encrypted) {
            return Crypto.decrypt(entry.value);
        }
        return entry.value;
    }

    // ========================================
    // ADVANCED QUERY OPERATIONS
    // ========================================

    prefixSearch(prefix) {
        const keys = Array.from(this.store.keys());
        return keys.filter(k => k.startsWith(prefix));
    }

    regexSearch(pattern) {
        const keys = Array.from(this.store.keys());
        const regex = new RegExp(pattern);
        return keys.filter(k => regex.test(k));
    }

    rangeQuery(start, end) {
        const keys = Array.from(this.store.keys()).sort();
        return keys.filter(k => k >= start && k <= end);
    }

    keysBySize(limit = 10) {
        const entries = Array.from(this.store.entries());
        return entries
            .map(([key, entry]) => ({
                key,
                size: JSON.stringify(entry.value).length
            }))
            .sort((a, b) => b.size - a.size)
            .slice(0, limit);
    }

    advancedQuery(type, pattern) {
        this.queryHistory.push({ type, pattern, timestamp: Date.now() });
        
        switch (type) {
            case 'prefix':
                return this.prefixSearch(pattern);
            case 'regex':
                return this.regexSearch(pattern);
            case 'range':
                const [start, end] = pattern.split(',');
                return this.rangeQuery(start, end);
            case 'size':
                return this.keysBySize(parseInt(pattern) || 10);
            default:
                return [];
        }
    }

    // ========================================
    // STORAGE ANALYSIS
    // ========================================

    analyze() {
        const entries = Array.from(this.store.entries());
        const totalSize = JSON.stringify(Array.from(this.store)).length;
        
        const analysis = {
            totalKeys: this.store.size,
            totalSize: totalSize,
            averageKeySize: entries.reduce((sum, [k]) => sum + k.length, 0) / entries.length || 0,
            averageValueSize: entries.reduce((sum, [, v]) => sum + JSON.stringify(v.value).length, 0) / entries.length || 0,
            encryptedKeys: this.encryptedKeys.size,
            expiredKeys: 0,
            largestKeys: this.keysBySize(5),
            keyPrefixes: this.analyzeKeyPrefixes()
        };

        // Check for expired keys
        entries.forEach(([key, entry]) => {
            if (entry.expiry && entry.expiry < Date.now()) {
                analysis.expiredKeys++;
            }
        });

        return analysis;
    }

    analyzeKeyPrefixes() {
        const prefixes = {};
        Array.from(this.store.keys()).forEach(key => {
            const prefix = key.split(':')[0];
            prefixes[prefix] = (prefixes[prefix] || 0) + 1;
        });
        return Object.entries(prefixes)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([prefix, count]) => ({ prefix, count }));
    }

    // ========================================
    // IMPORT / EXPORT
    // ========================================

    export(format = 'json') {
        const entries = Array.from(this.store.entries()).map(([key, entry]) => ({
            key,
            value: this.processValue(entry.value, entry),
            timestamp: entry.timestamp,
            encrypted: entry.encrypted || false,
            ttl: entry.expiry ? Math.max(0, Math.floor((entry.expiry - Date.now()) / 1000)) : null
        }));

        switch (format) {
            case 'json':
                return JSON.stringify(entries, null, 2);
            case 'csv':
                const csv = ['Key,Value,Timestamp,Encrypted,TTL'];
                entries.forEach(e => {
                    csv.push(`"${e.key}","${e.value}","${e.timestamp}",${e.encrypted},${e.ttl}`);
                });
                return csv.join('\n');
            case 'txt':
                return entries.map(e => `${e.key} = ${e.value}`).join('\n');
            default:
                return JSON.stringify(entries);
        }
    }

    import(data, format = 'json') {
        try {
            let entries;
            
            switch (format) {
                case 'json':
                    entries = JSON.parse(data);
                    break;
                case 'csv':
                    const lines = data.split('\n').slice(1); // Skip header
                    entries = lines.map(line => {
                        const [key, value] = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
                        return { key, value };
                    });
                    break;
                case 'txt':
                    const txtLines = data.split('\n');
                    entries = txtLines.map(line => {
                        const [key, value] = line.split('=').map(s => s.trim());
                        return { key, value };
                    });
                    break;
                default:
                    throw new Error('Unsupported format');
            }

            let imported = 0;
            entries.forEach(entry => {
                if (entry.key && entry.value) {
                    this.put(entry.key, entry.value, { ttl: entry.ttl || null });
                    imported++;
                }
            });

            return { success: true, imported, total: entries.length };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // ========================================
    // CACHE MANAGEMENT
    // ========================================

    updateCache(key, entry) {
        if (this.cache.size >= this.cacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, entry);
    }

    processValue(value, entry) {
        let processed = value;
        
        if (entry.compressed) {
            processed = Compression.decompress(processed);
        }
        
        if (entry.encrypted) {
            processed = Crypto.decrypt(processed);
        }
        
        return processed;
    }

    // ========================================
    // PERSISTENCE
    // ========================================

    persist() {
        try {
            const data = {
                store: Array.from(this.store.entries()),
                encryptedKeys: Array.from(this.encryptedKeys),
                wal: this.wal.slice(-1000)
            };
            localStorage.setItem('kvstore-pro', JSON.stringify(data));
        } catch (e) {
            console.error('Failed to persist:', e);
        }
    }

    loadFromStorage() {
        try {
            const data = localStorage.getItem('kvstore-pro');
            if (data) {
                const parsed = JSON.parse(data);
                this.store = new Map(parsed.store);
                this.encryptedKeys = new Set(parsed.encryptedKeys || []);
                this.wal = parsed.wal || [];
            }
        } catch (e) {
            console.error('Failed to load:', e);
        }
    }

    // ========================================
    // STATISTICS & MONITORING
    // ========================================

    recordStats(operation, latency) {
        this.stats.totalOps++;
        this.stats[operation.toLowerCase() + 'Ops'] = (this.stats[operation.toLowerCase() + 'Ops'] || 0) + 1;
        this.stats.latencies.push(latency);
        this.stats.timestamps.push(Date.now());
        
        if (this.stats.latencies.length > 100) {
            this.stats.latencies.shift();
            this.stats.timestamps.shift();
        }
    }

    resetStats() {
        this.stats = {
            totalOps: 0,
            putOps: 0,
            getOps: 0,
            deleteOps: 0,
            cacheHits: 0,
            cacheMisses: 0,
            latencies: [],
            opsPerSecond: [],
            timestamps: []
        };
    }

    getStats() {
        const avgLatency = this.stats.latencies.length > 0
            ? this.stats.latencies.reduce((a, b) => a + b, 0) / this.stats.latencies.length
            : 0;
        
        const cacheHitRate = this.stats.totalOps > 0
            ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) * 100)
            : 0;

        const storageSize = JSON.stringify(Array.from(this.store)).length;

        // Calculate ops/sec
        const now = Date.now();
        const oneSecondAgo = now - 1000;
        const recentOps = this.stats.timestamps.filter(t => t > oneSecondAgo).length;

        return {
            totalKeys: this.store.size,
            totalOps: this.stats.totalOps,
            putOps: this.stats.putOps || 0,
            getOps: this.stats.getOps || 0,
            deleteOps: this.stats.deleteOps || 0,
            avgLatency: avgLatency.toFixed(2),
            cacheHitRate: cacheHitRate.toFixed(1),
            storageSize: (storageSize / 1024).toFixed(2),
            encryptedKeys: this.encryptedKeys.size,
            opsPerSecond: recentOps,
            cacheSize: this.cache.size
        };
    }

    startMonitoring() {
        if (this.monitoring.interval) return;
        
        this.monitoring.interval = setInterval(() => {
            if (this.monitoring.enabled) {
                const stats = this.getStats();
                updateMonitoringDisplay(stats);
                updateCharts(stats);
            }
        }, 1000);
    }

    stopMonitoring() {
        if (this.monitoring.interval) {
            clearInterval(this.monitoring.interval);
            this.monitoring.interval = null;
        }
    }

    getAllEntries() {
        return Array.from(this.store.entries()).map(([key, entry]) => ({
            key,
            value: this.processValue(entry.value, entry),
            timestamp: entry.timestamp,
            encrypted: entry.encrypted || false,
            ttl: entry.expiry ? Math.max(0, Math.floor((entry.expiry - Date.now()) / 1000)) : null
        }));
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================
const kvStore = new TinyKVStorePro();

// ============================================
// UI FUNCTIONS
// ============================================

function kvPut() {
    const key = document.getElementById('key').value.trim();
    const value = document.getElementById('value').value.trim();
    const ttl = parseInt(document.getElementById('ttl').value) || 0;

    if (!key || !value) {
        showToast('Please enter both key and value', 'error');
        return;
    }

    try {
        const options = ttl > 0 ? { ttl } : {};
        const result = kvStore.put(key, value, options);
        addTerminalLine(`PUT ${key} = ${value}${ttl > 0 ? ` TTL=${ttl}s` : ''}`, 'success');
        addTerminalLine(`✓ Success (${result.latency}ms)`, 'info');
        updateVisualization();
        updateStats();
        showToast('Key-value pair stored successfully!');
        
        // Clear inputs
        document.getElementById('key').value = '';
        document.getElementById('value').value = '';
        document.getElementById('ttl').value = '';
    } catch (e) {
        addTerminalLine(`✗ Error: ${e.message}`, 'error');
        showToast(e.message, 'error');
    }
}

function kvGet() {
    const key = document.getElementById('key').value.trim();

    if (!key) {
        showToast('Please enter a key', 'error');
        return;
    }

    const value = kvStore.get(key);
    
    if (value === null) {
        addTerminalLine(`GET ${key}`, 'info');
        addTerminalLine(`✗ Key not found`, 'error');
        showToast('Key not found', 'error');
    } else {
        addTerminalLine(`GET ${key}`, 'info');
        addTerminalLine(`✓ Value: ${value}`, 'success');
        showToast(`Value: ${value}`);
        document.getElementById('value').value = value;
    }
    
    updateStats();
}

function kvDelete() {
    const key = document.getElementById('key').value.trim();

    if (!key) {
        showToast('Please enter a key', 'error');
        return;
    }

    const result = kvStore.delete(key);
    
    if (result.success) {
        addTerminalLine(`DELETE ${key}`, 'info');
        addTerminalLine(`✓ Key deleted (${result.latency}ms)`, 'success');
        updateVisualization();
        updateStats();
        showToast('Key deleted successfully!');
        document.getElementById('key').value = '';
    } else {
        addTerminalLine(`DELETE ${key}`, 'info');
        addTerminalLine(`✗ Key not found`, 'error');
        showToast('Key not found', 'error');
    }
}

function kvExists() {
    const key = document.getElementById('key').value.trim();
    if (!key) {
        showToast('Please enter a key', 'error');
        return;
    }

    const exists = kvStore.exists(key);
    addTerminalLine(`EXISTS ${key}`, 'info');
    addTerminalLine(`✓ Result: ${exists}`, exists ? 'success' : 'warning');
    showToast(`Key ${exists ? 'exists' : 'does not exist'}`);
}

function kvKeys() {
    const pattern = document.getElementById('key').value.trim() || '*';
    const keys = kvStore.keys(pattern);
    
    addTerminalLine(`KEYS ${pattern}`, 'info');
    addTerminalLine(`✓ Found ${keys.length} keys`, 'success');
    
    if (keys.length > 0) {
        keys.slice(0, 10).forEach(k => {
            addTerminalLine(`  - ${k}`, 'info');
        });
        if (keys.length > 10) {
            addTerminalLine(`  ... and ${keys.length - 10} more`, 'info');
        }
    }
    
    showToast(`Found ${keys.length} keys`);
}

function kvClear() {
    if (confirm('Are you sure you want to clear all data?')) {
        kvStore.clear();
        addTerminalLine('CLEAR ALL', 'info');
        addTerminalLine('✓ All data cleared', 'success');
        updateVisualization();
        updateStats();
        showToast('All data cleared!');
    }
}

function kvBatch() {
    try {
        const input = document.getElementById('batchInput').value;
        const operations = JSON.parse(input);
        
        addTerminalLine('BATCH EXECUTE', 'info');
        
        const result = kvStore.batch(operations);
        
        addTerminalLine(`✓ Batch completed: ${result.opsPerformed} operations in ${result.totalTime}ms`, 'success');
        
        result.results.forEach(r => {
            const status = r.result.success ? '✓' : '✗';
            addTerminalLine(`  ${status} ${r.op} ${r.key}`, r.result.success ? 'success' : 'error');
        });
        
        updateVisualization();
        updateStats();
        showToast('Batch operations completed!');
    } catch (e) {
        addTerminalLine(`✗ Error: ${e.message}`, 'error');
        showToast('Invalid JSON format', 'error');
    }
}

function validateBatch() {
    try {
        const input = document.getElementById('batchInput').value;
        JSON.parse(input);
        showToast('✓ JSON is valid!', 'success');
        addTerminalLine('JSON validation passed', 'success');
    } catch (e) {
        showToast('✗ Invalid JSON: ' + e.message, 'error');
        addTerminalLine(`JSON validation failed: ${e.message}`, 'error');
    }
}

function kvPutEncrypted() {
    const key = document.getElementById('encKey').value.trim();
    const value = document.getElementById('encValue').value.trim();

    if (!key || !value) {
        showToast('Please enter both key and value', 'error');
        return;
    }

    try {
        kvStore.putEncrypted(key, value);
        addTerminalLine(`PUT (ENCRYPTED) ${key} = [ENCRYPTED]`, 'success');
        addTerminalLine(`✓ Value encrypted and stored`, 'info');
        updateVisualization();
        updateStats();
        showToast('Encrypted value stored successfully!');
        
        document.getElementById('encKey').value = '';
        document.getElementById('encValue').value = '';
    } catch (e) {
        addTerminalLine(`✗ Error: ${e.message}`, 'error');
        showToast(e.message, 'error');
    }
}

function kvGetDecrypted() {
    const key = document.getElementById('encKey').value.trim();

    if (!key) {
        showToast('Please enter a key', 'error');
        return;
    }

    const value = kvStore.getDecrypted(key);
    
    if (value === null) {
        addTerminalLine(`GET (DECRYPT) ${key}`, 'info');
        addTerminalLine(`✗ Key not found`, 'error');
        showToast('Key not found', 'error');
    } else {
        addTerminalLine(`GET (DECRYPT) ${key}`, 'info');
        addTerminalLine(`✓ Decrypted value: ${value}`, 'success');
        showToast('Value decrypted successfully!');
        document.getElementById('encValue').value = value;
    }
    
    updateStats();
}

function kvAdvancedQuery() {
    const type = document.getElementById('queryType').value;
    const pattern = document.getElementById('queryPattern').value.trim();

    if (!pattern) {
        showToast('Please enter a query pattern', 'error');
        return;
    }

    try {
        const results = kvStore.advancedQuery(type, pattern);
        
        addTerminalLine(`QUERY (${type}) ${pattern}`, 'info');
        addTerminalLine(`✓ Found ${results.length} results`, 'success');
        
        const resultsDiv = document.getElementById('queryResults');
        if (results.length > 0) {
            let html = '<div style="background: rgba(37,99,235,0.1); padding: 1rem; border-radius: 10px; margin-top: 1rem;">';
            html += '<h4 style="color: var(--primary); margin-bottom: 0.5rem;">Query Results:</h4>';
            results.forEach(r => {
                if (typeof r === 'object' && r.key) {
                    html += `<div style="padding: 0.5rem; margin: 0.3rem 0; background: white; border-radius: 5px;">
                        <strong>${r.key}</strong> (${r.size} bytes)
                    </div>`;
                } else {
                    html += `<div style="padding: 0.5rem; margin: 0.3rem 0; background: white; border-radius: 5px;">${r}</div>`;
                }
            });
            html += '</div>';
            resultsDiv.innerHTML = html;
        } else {
            resultsDiv.innerHTML = '<p style="color: #64748b; margin-top: 1rem;">No results found</p>';
        }
        
        showToast(`Found ${results.length} results`);
    } catch (e) {
        addTerminalLine(`✗ Error: ${e.message}`, 'error');
        showToast(e.message, 'error');
    }
}

// ============================================
// VISUALIZATION FUNCTIONS
// ============================================

function updateVisualization() {
    const container = document.getElementById('kvPairs');
    const entries = kvStore.getAllEntries();
    
    if (entries.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 2rem;">No data stored yet. Add some key-value pairs to get started!</p>';
        return;
    }

    container.innerHTML = entries.map(entry => {
        const encrypted = entry.encrypted ? '🔐' : '';
        const ttl = entry.ttl > 0 ? `⏱️ ${entry.ttl}s` : '';
        
        return `
            <div class="kv-pair">
                <div>
                    <span class="kv-key">${encrypted} ${escapeHtml(entry.key)}</span>
                    <span style="margin: 0 1rem;">→</span>
                    <span class="kv-value">${escapeHtml(String(entry.value).substring(0, 50))}${String(entry.value).length > 50 ? '...' : ''}</span>
                    ${ttl ? `<span style="margin-left: 1rem; opacity: 0.8;">${ttl}</span>` : ''}
                </div>
                <div class="kv-actions">
                    <button class="kv-edit" onclick="editEntry('${escapeHtml(entry.key)}')">Edit</button>
                    <button class="kv-delete" onclick="deleteEntry('${escapeHtml(entry.key)}')">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function editEntry(key) {
    const value = kvStore.get(key);
    if (value !== null) {
        document.getElementById('key').value = key;
        document.getElementById('value').value = value;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('Edit mode: Update the value and click PUT');
    }
}

function deleteEntry(key) {
    kvStore.delete(key);
    updateVisualization();
    updateStats();
    addTerminalLine(`DELETE ${key}`, 'info');
    addTerminalLine(`✓ Entry deleted`, 'success');
    showToast('Entry deleted!');
}

// ============================================
// STATISTICS FUNCTIONS
// ============================================

function updateStats() {
    const stats = kvStore.getStats();
    
    document.getElementById('totalKeys').textContent = stats.totalKeys;
    document.getElementById('totalOps').textContent = stats.totalOps;
    document.getElementById('avgLatency').textContent = stats.avgLatency + 'ms';
    document.getElementById('cacheHits').textContent = stats.cacheHitRate + '%';
    document.getElementById('storageSize').textContent = stats.storageSize + ' KB';
    document.getElementById('encryptedKeys').textContent = stats.encryptedKeys;
    
    // Footer stats
    document.getElementById('footerKeys').textContent = stats.totalKeys;
    document.getElementById('footerOps').textContent = stats.totalOps;
    document.getElementById('footerStorage').textContent = stats.storageSize + ' KB';
}

function updateMonitoringDisplay(stats) {
    // Update monitoring cards
    document.getElementById('memUsage').textContent = stats.storageSize + ' KB';
    document.getElementById('opsPerSec').textContent = stats.opsPerSecond;
    document.getElementById('cacheEff').textContent = stats.cacheHitRate + '%';
    document.getElementById('avgLat').textContent = stats.avgLatency + 'ms';
    
    // Update progress bars
    const memPercent = Math.min((parseFloat(stats.storageSize) / 1024) * 100, 100);
    const opsPercent = Math.min((stats.opsPerSecond / 100) * 100, 100);
    const cachePercent = parseFloat(stats.cacheHitRate);
    const latPercent = Math.min((parseFloat(stats.avgLatency) / 10) * 100, 100);
    
    document.getElementById('memBar').style.width = memPercent + '%';
    document.getElementById('opsBar').style.width = opsPercent + '%';
    document.getElementById('cacheBar').style.width = cachePercent + '%';
    document.getElementById('latBar').style.width = latPercent + '%';
}

// ============================================
// CHARTS (Simple Canvas Implementation)
// ============================================

let chartsData = {
    ops: [],
    latency: []
};

function updateCharts(stats) {
    // Store data points
    chartsData.ops.push(stats.opsPerSecond);
    chartsData.latency.push(parseFloat(stats.avgLatency));
    
    // Keep last 20 data points
    if (chartsData.ops.length > 20) {
        chartsData.ops.shift();
        chartsData.latency.shift();
    }
    
    drawOpsChart();
    drawLatencyChart();
}

function drawOpsChart() {
    const canvas = document.getElementById('opsCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (chartsData.ops.length < 2) return;
    
    const max = Math.max(...chartsData.ops, 10);
    const step = width / (chartsData.ops.length - 1);
    
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    chartsData.ops.forEach((value, index) => {
        const x = index * step;
        const y = height - (value / max) * height;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
}

function drawLatencyChart() {
    const canvas = document.getElementById('latencyCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (chartsData.latency.length < 2) return;
    
    const max = Math.max(...chartsData.latency, 5);
    const step = width / (chartsData.latency.length - 1);
    
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    chartsData.latency.forEach((value, index) => {
        const x = index * step;
        const y = height - (value / max) * height;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
}

// ============================================
// IMPORT/EXPORT FUNCTIONS
// ============================================

function openImportExport() {
    document.getElementById('importExportModal').style.display = 'flex';
}

function switchImportExportTab(tab) {
    document.querySelectorAll('#importExportModal .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#importExportModal .tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tab).classList.add('active');
}

function exportData() {
    const format = document.getElementById('exportFormat').value;
    const data = kvStore.export(format);
    
    const preview = document.getElementById('exportPreview');
    preview.textContent = data.substring(0, 500) + (data.length > 500 ? '...' : '');
    preview.style.display = 'block';
    
    showToast('Export preview generated!');
}

function performExport() {
    const format = document.getElementById('exportFormat').value;
    const data = kvStore.export(format);
    
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvstore-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    
    addTerminalLine(`EXPORT ${format.toUpperCase()}`, 'info');
    addTerminalLine(`✓ Data exported successfully`, 'success');
    showToast('Data exported successfully!');
}

function performImport() {
    const file = document.getElementById('importFile').files[0];
    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = e.target.result;
        const format = file.name.split('.').pop();
        
        const result = kvStore.import(data, format);
        
        const resultsDiv = document.getElementById('importResults');
        if (result.success) {
            resultsDiv.innerHTML = `
                <div style="background: rgba(16,185,129,0.1); padding: 1rem; border-radius: 10px; margin-top: 1rem; color: var(--success);">
                    ✓ Successfully imported ${result.imported} of ${result.total} entries
                </div>
            `;
            addTerminalLine(`IMPORT ${format.toUpperCase()}`, 'info');
            addTerminalLine(`✓ Imported ${result.imported}/${result.total} entries`, 'success');
            updateVisualization();
            updateStats();
            showToast('Data imported successfully!');
        } else {
            resultsDiv.innerHTML = `
                <div style="background: rgba(239,68,68,0.1); padding: 1rem; border-radius: 10px; margin-top: 1rem; color: var(--danger);">
                    ✗ Import failed: ${result.error}
                </div>
            `;
            showToast('Import failed: ' + result.error, 'error');
        }
    };
    reader.readAsText(file);
}

function analyzeStorage() {
    const analysis = kvStore.analyze();
    
    let content = '<h2 style="color: var(--primary); margin-bottom: 1.5rem;">📊 Storage Analysis</h2>';
    content += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">';
    content += `
        <div style="background: rgba(37,99,235,0.1); padding: 1rem; border-radius: 10px;">
            <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${analysis.totalKeys}</div>
            <div style="color: #64748b;">Total Keys</div>
        </div>
        <div style="background: rgba(124,58,237,0.1); padding: 1rem; border-radius: 10px;">
            <div style="font-size: 2rem; font-weight: bold; color: var(--secondary);">${(analysis.totalSize / 1024).toFixed(2)} KB</div>
            <div style="color: #64748b;">Total Size</div>
        </div>
        <div style="background: rgba(16,185,129,0.1); padding: 1rem; border-radius: 10px;">
            <div style="font-size: 2rem; font-weight: bold; color: var(--success);">${analysis.averageKeySize.toFixed(1)}</div>
            <div style="color: #64748b;">Avg Key Size</div>
        </div>
        <div style="background: rgba(245,158,11,0.1); padding: 1rem; border-radius: 10px;">
            <div style="font-size: 2rem; font-weight: bold; color: var(--warning);">${analysis.averageValueSize.toFixed(1)}</div>
            <div style="color: #64748b;">Avg Value Size</div>
        </div>
    `;
    content += '</div>';
    
    content += '<h3 style="color: var(--primary); margin-top: 2rem; margin-bottom: 1rem;">Largest Keys</h3>';
    content += '<div>';
    analysis.largestKeys.forEach(item => {
        content += `<div style="padding: 0.75rem; margin: 0.5rem 0; background: rgba(37,99,235,0.05); border-radius: 8px; display: flex; justify-content: space-between;">
            <span style="font-family: monospace;">${item.key}</span>
            <span style="color: var(--primary); font-weight: bold;">${item.size} bytes</span>
        </div>`;
    });
    content += '</div>';
    
    content += '<h3 style="color: var(--primary); margin-top: 2rem; margin-bottom: 1rem;">Key Prefixes</h3>';
    content += '<div>';
    analysis.keyPrefixes.forEach(item => {
        content += `<div style="padding: 0.75rem; margin: 0.5rem 0; background: rgba(37,99,235,0.05); border-radius: 8px; display: flex; justify-content: space-between;">
            <span style="font-family: monospace;">${item.prefix}:*</span>
            <span style="color: var(--primary); font-weight: bold;">${item.count} keys</span>
        </div>`;
    });
    content += '</div>';
    
    showModal(content);
    
    addTerminalLine('ANALYZE STORAGE', 'info');
    addTerminalLine(`✓ Analysis complete: ${analysis.totalKeys} keys, ${(analysis.totalSize / 1024).toFixed(2)} KB`, 'success');
}

// ============================================
// TERMINAL FUNCTIONS
// ============================================

function addTerminalLine(text, type = 'info') {
    const terminal = document.getElementById('terminal');
    const line = document.createElement('div');
    line.className = `terminal-line terminal-${type}`;
    line.innerHTML = `<span class="terminal-prompt">$</span> ${escapeHtml(text)}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;

    while (terminal.children.length > 100) {
        terminal.removeChild(terminal.children[0]);
    }
}

// ============================================
// UI HELPER FUNCTIONS
// ============================================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function showModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal" onclick="this.closest('.modal').remove()">&times;</span>
            ${content}
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function switchTab(tabName) {
    document.querySelectorAll('.demo-container .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.demo-container .tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// ============================================
// THEME FUNCTIONS
// ============================================

const themes = ['light', 'dark', 'cyberpunk'];
let currentThemeIndex = 0;

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    const theme = themes[currentThemeIndex];
    document.body.setAttribute('data-theme', theme);
    
    const icons = { light: '☀️', dark: '🌙', cyberpunk: '🌈' };
    document.getElementById('themeToggle').textContent = icons[theme];
    
    showToast(`Theme changed to ${theme} mode`);
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function showKeyboardShortcuts() {
    document.getElementById('shortcutsModal').style.display = 'flex';
}

document.addEventListener('keydown', (e) => {
    // Ctrl+K: Command Palette
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        toggleCommandPalette();
    }
    
    // Ctrl+T: Toggle Theme
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        cycleTheme();
    }
    
    // Ctrl+E: Export
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        openImportExport();
    }
    
    // Ctrl+H: Help
    if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        showKeyboardShortcuts();
    }
    
    // Ctrl+Shift+C: Clear All
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        kvClear();
    }
    
    // Escape: Close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        document.getElementById('commandPalette').style.display = 'none';
    }
});

// ============================================
// COMMAND PALETTE
// ============================================

const commands = [
    { name: 'Clear All Data', action: () => kvClear(), shortcut: 'Ctrl+Shift+C' },
    { name: 'Export Data', action: () => openImportExport(), shortcut: 'Ctrl+E' },
    { name: 'Analyze Storage', action: () => analyzeStorage(), shortcut: '' },
    { name: 'Show Statistics', action: () => updateStats(), shortcut: 'Ctrl+S' },
    { name: 'Toggle Theme', action: () => cycleTheme(), shortcut: 'Ctrl+T' },
    { name: 'Keyboard Shortcuts', action: () => showKeyboardShortcuts(), shortcut: 'Ctrl+H' }
];

function toggleCommandPalette() {
    const palette = document.getElementById('commandPalette');
    const isVisible = palette.style.display === 'block';
    palette.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        document.getElementById('commandInput').value = '';
        document.getElementById('commandInput').focus();
        renderCommands();
    }
}

function renderCommands(filter = '') {
    const results = document.getElementById('commandResults');
    const filtered = commands.filter(c => 
        c.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    results.innerHTML = filtered.map(cmd => `
        <div class="command-item" onclick='${cmd.action.toString()}(); toggleCommandPalette();'>
            <span>${cmd.name}</span>
            <span class="command-shortcut">${cmd.shortcut}</span>
        </div>
    `).join('');
}

document.getElementById('commandInput').addEventListener('input', (e) => {
    renderCommands(e.target.value);
});

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

document.getElementById('globalSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (query.length < 2) return;
    
    // Search in keys
    const results = kvStore.prefixSearch(query);
    console.log('Search results:', results);
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    updateVisualization();
    updateStats();
    
    // Add some demo data
    setTimeout(() => {
        kvStore.put('user:001', 'Alice Johnson');
        kvStore.put('user:002', 'Bob Smith');
        kvStore.put('session:abc123', 'active', { ttl: 3600 });
        kvStore.putEncrypted('secret:password', 'MySecurePassword123!');
        kvStore.put('config:theme', 'dark');
        kvStore.put('config:language', 'en-US');
        
        updateVisualization();
        updateStats();
        addTerminalLine('Demo data loaded successfully', 'success');
        addTerminalLine(`Loaded 6 sample entries (1 encrypted, 1 with TTL)`, 'info');
    }, 1000);
});

console.log('%c🗄️ Tiny KV Store Pro v2.0.0', 'font-size: 20px; color: #2563eb; font-weight: bold;');
console.log('%cAdvanced features loaded successfully!', 'font-size: 14px; color: #10b981;');
console.log('%cPress Ctrl+K for command palette, Ctrl+H for help', 'font-size: 12px; color: #64748b;');