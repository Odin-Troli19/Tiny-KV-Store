# 📚 Tiny KV Store Pro - Complete API Reference

## Table of Contents

- [Core Operations](#core-operations)
- [Advanced Operations](#advanced-operations)
- [Batch Operations](#batch-operations)
- [Encryption](#encryption)
- [Query Operations](#query-operations)
- [Import/Export](#importexport)
- [Statistics & Monitoring](#statistics--monitoring)
- [Cache Management](#cache-management)
- [Utility Methods](#utility-methods)

---

## Core Operations

### `put(key, value, options)`

Store a key-value pair in the store.

**Signature:**
```javascript
put(key: string, value: any, options?: {
  ttl?: number,
  encrypted?: boolean,
  compress?: boolean
}): { success: boolean, latency: string }
```

**Parameters:**
- `key` (string, required): Unique identifier for the value
- `value` (any, required): Value to store
- `options` (object, optional):
  - `ttl` (number): Time-to-live in seconds
  - `encrypted` (boolean): Enable encryption
  - `compress` (boolean): Enable compression

**Returns:**
- Object with `success` (boolean) and `latency` (string in ms)

**Examples:**

```javascript
// Basic usage
kvStore.put('user:123', 'John Doe');
// { success: true, latency: "0.87" }

// With TTL (expires after 1 hour)
kvStore.put('session:abc', 'active', { ttl: 3600 });

// With encryption
kvStore.put('secret:key', 'myPassword', { encrypted: true });

// With compression
kvStore.put('large:data', bigString, { compress: true });

// All options combined
kvStore.put('temp:secret', 'data', {
  ttl: 300,
  encrypted: true,
  compress: true
});
```

**Error Handling:**
```javascript
try {
  kvStore.put('key', 'value');
} catch (error) {
  console.error('PUT failed:', error.message);
}
```

---

### `get(key)`

Retrieve a value by its key.

**Signature:**
```javascript
get(key: string): any | null
```

**Parameters:**
- `key` (string, required): Key to retrieve

**Returns:**
- The stored value, or `null` if not found or expired

**Examples:**

```javascript
// Basic retrieval
const value = kvStore.get('user:123');
// "John Doe"

// Check for null
const value = kvStore.get('nonexistent');
if (value === null) {
  console.log('Key not found');
}

// With type checking
const user = kvStore.get('user:123');
if (typeof user === 'string') {
  console.log('User:', user);
}

// Retrieve JSON data
kvStore.put('config', JSON.stringify({ theme: 'dark' }));
const config = JSON.parse(kvStore.get('config'));
```

**Cache Behavior:**
- First GET: Cache miss, reads from store
- Subsequent GETs: Cache hit, faster retrieval
- Cache automatically updated on PUT/DELETE

---

### `delete(key)`

Remove a key-value pair from the store.

**Signature:**
```javascript
delete(key: string): { success: boolean, latency: string }
```

**Parameters:**
- `key` (string, required): Key to delete

**Returns:**
- Object with `success` (true if key existed) and `latency`

**Examples:**

```javascript
// Delete a key
const result = kvStore.delete('user:123');
console.log(result.success); // true

// Delete non-existent key
const result = kvStore.delete('nonexistent');
console.log(result.success); // false

// Bulk delete with pattern
const keys = kvStore.keys('temp:*');
keys.forEach(key => kvStore.delete(key));

// Delete with confirmation
function safeDelete(key) {
  if (kvStore.exists(key)) {
    if (confirm(`Delete ${key}?`)) {
      return kvStore.delete(key);
    }
  }
  return { success: false };
}
```

---

### `exists(key)`

Check if a key exists in the store.

**Signature:**
```javascript
exists(key: string): boolean
```

**Parameters:**
- `key` (string, required): Key to check

**Returns:**
- `true` if key exists and hasn't expired, `false` otherwise

**Examples:**

```javascript
// Simple existence check
if (kvStore.exists('user:123')) {
  console.log('User exists');
}

// Before-get pattern
if (kvStore.exists('config')) {
  const config = kvStore.get('config');
  // Use config
}

// Validation
function validateKey(key) {
  if (!kvStore.exists(key)) {
    throw new Error(`Key ${key} does not exist`);
  }
}

// Multiple key check
const keys = ['user:1', 'user:2', 'user:3'];
const existing = keys.filter(k => kvStore.exists(k));
console.log('Existing keys:', existing);
```

---

### `keys(pattern)`

Get all keys matching a glob pattern.

**Signature:**
```javascript
keys(pattern?: string): string[]
```

**Parameters:**
- `pattern` (string, optional): Glob pattern (* and ? wildcards). Default: '*'

**Returns:**
- Array of matching key strings

**Pattern Syntax:**
- `*` - Matches any sequence of characters
- `?` - Matches any single character
- Literal characters match themselves

**Examples:**

```javascript
// All keys
const allKeys = kvStore.keys();
// or
const allKeys = kvStore.keys('*');

// User keys
const users = kvStore.keys('user:*');
// ['user:1', 'user:2', 'user:3']

// Session keys with specific pattern
const sessions = kvStore.keys('session:???');
// ['session:abc', 'session:xyz']

// Keys starting with 'temp'
const tempKeys = kvStore.keys('temp*');

// Count keys by prefix
function countByPrefix(prefix) {
  return kvStore.keys(prefix + '*').length;
}

// List all prefixes
function getAllPrefixes() {
  const keys = kvStore.keys();
  const prefixes = new Set();
  keys.forEach(key => {
    const prefix = key.split(':')[0];
    prefixes.add(prefix);
  });
  return Array.from(prefixes);
}
```

---

### `clear()`

Remove all data from the store.

**Signature:**
```javascript
clear(): void
```

**Parameters:** None

**Returns:** void

**Side Effects:**
- Clears all key-value pairs
- Clears cache
- Clears encrypted keys set
- Clears WAL
- Resets statistics
- Persists empty state

**Examples:**

```javascript
// Simple clear
kvStore.clear();

// Clear with confirmation
if (confirm('Delete all data?')) {
  kvStore.clear();
}

// Clear with backup
const backup = kvStore.export('json');
localStorage.setItem('backup', backup);
kvStore.clear();

// Clear specific namespace
function clearNamespace(prefix) {
  const keys = kvStore.keys(prefix + '*');
  keys.forEach(key => kvStore.delete(key));
}
clearNamespace('temp');
```

---

## Advanced Operations

### `scan(cursor, options)`

Iterate through keys with pagination.

**Signature:**
```javascript
scan(cursor?: number, options?: {
  count?: number,
  match?: string
}): { cursor: number, keys: string[] }
```

**Parameters:**
- `cursor` (number, optional): Starting position. Default: 0
- `options` (object, optional):
  - `count` (number): Results per page. Default: 10
  - `match` (string): Pattern to match

**Returns:**
- Object with `cursor` (next position, 0 if done) and `keys` array

**Examples:**

```javascript
// Basic pagination
let cursor = 0;
do {
  const result = kvStore.scan(cursor, { count: 10 });
  console.log('Keys:', result.keys);
  cursor = result.cursor;
} while (cursor !== 0);

// With pattern matching
const result = kvStore.scan(0, {
  count: 20,
  match: 'user:*'
});

// Pagination helper
function* paginateKeys(pageSize = 10) {
  let cursor = 0;
  do {
    const result = kvStore.scan(cursor, { count: pageSize });
    yield result.keys;
    cursor = result.cursor;
  } while (cursor !== 0);
}

// Usage
for (const page of paginateKeys(50)) {
  console.log('Page:', page);
}
```

---

## Batch Operations

### `batch(operations)`

Execute multiple operations atomically.

**Signature:**
```javascript
batch(operations: Array<{
  op: 'PUT' | 'GET' | 'DELETE' | 'EXISTS',
  key: string,
  value?: any,
  ttl?: number
}>): {
  success: boolean,
  results: Array<any>,
  totalTime: string,
  opsPerformed: number
}
```

**Parameters:**
- `operations` (array, required): Array of operation objects

**Returns:**
- Object with execution results

**Examples:**

```javascript
// Mixed operations
const result = kvStore.batch([
  { op: 'PUT', key: 'user:1', value: 'Alice' },
  { op: 'PUT', key: 'user:2', value: 'Bob', ttl: 3600 },
  { op: 'GET', key: 'user:1' },
  { op: 'DELETE', key: 'old:key' },
  { op: 'EXISTS', key: 'user:2' }
]);

console.log(result);
// {
//   success: true,
//   results: [
//     { op: 'PUT', key: 'user:1', result: { success: true, latency: "0.5" } },
//     ...
//   ],
//   totalTime: "5.67",
//   opsPerformed: 5
// }

// Bulk insert
const users = ['Alice', 'Bob', 'Charlie'];
const ops = users.map((name, i) => ({
  op: 'PUT',
  key: `user:${i}`,
  value: name
}));
kvStore.batch(ops);

// Transaction pattern
function transferBalance(from, to, amount) {
  const ops = [
    { op: 'GET', key: `balance:${from}` },
    { op: 'GET', key: `balance:${to}` },
    { op: 'PUT', key: `balance:${from}`, value: fromBalance - amount },
    { op: 'PUT', key: `balance:${to}`, value: toBalance + amount }
  ];
  return kvStore.batch(ops);
}

// Error handling
const result = kvStore.batch(operations);
if (!result.success) {
  console.error('Batch failed');
  result.results.forEach(r => {
    if (!r.result.success) {
      console.error('Failed:', r.op, r.key);
    }
  });
}
```

---

## Encryption

### `putEncrypted(key, value, ttl)`

Store an encrypted value.

**Signature:**
```javascript
putEncrypted(key: string, value: string, ttl?: number): {
  success: boolean,
  latency: string
}
```

**Parameters:**
- `key` (string, required): Storage key
- `value` (string, required): Value to encrypt
- `ttl` (number, optional): Time-to-live in seconds

**Returns:**
- Same as `put()` method

**Examples:**

```javascript
// Store password
kvStore.putEncrypted('user:password', 'MySecurePass123!');

// Store API key with TTL
kvStore.putEncrypted('api:key', 'sk-proj-abc123', 3600);

// Store multiple secrets
const secrets = {
  'api:stripe': 'sk_live_...',
  'api:sendgrid': 'SG....',
  'db:password': 'dbPass123'
};
Object.entries(secrets).forEach(([key, value]) => {
  kvStore.putEncrypted(key, value);
});

// Configuration with secrets
const config = {
  apiKey: 'secret-key',
  dbUrl: 'postgresql://...'
};
kvStore.putEncrypted('config:prod', JSON.stringify(config));
```

---

### `getDecrypted(key)`

Retrieve and decrypt a value.

**Signature:**
```javascript
getDecrypted(key: string): string | null
```

**Parameters:**
- `key` (string, required): Key to retrieve

**Returns:**
- Decrypted string or `null`

**Examples:**

```javascript
// Retrieve password
const password = kvStore.getDecrypted('user:password');

// Safe retrieval
const apiKey = kvStore.getDecrypted('api:key');
if (apiKey) {
  // Use API key
  makeRequest(apiKey);
} else {
  console.error('API key not found');
}

// Retrieve and parse
const configStr = kvStore.getDecrypted('config:prod');
const config = configStr ? JSON.parse(configStr) : {};

// Check encryption status
if (kvStore.encryptedKeys.has('user:password')) {
  const decrypted = kvStore.getDecrypted('user:password');
}
```

---

## Query Operations

### `prefixSearch(prefix)`

Find all keys with a given prefix.

**Signature:**
```javascript
prefixSearch(prefix: string): string[]
```

**Parameters:**
- `prefix` (string, required): Prefix to match

**Returns:**
- Array of matching keys

**Examples:**

```javascript
// Find all users
const users = kvStore.prefixSearch('user:');
// ['user:1', 'user:2', 'user:3']

// Find sessions
const sessions = kvStore.prefixSearch('session:');

// Namespace search
const tempKeys = kvStore.prefixSearch('temp:');

// Hierarchical search
const adminUsers = kvStore.prefixSearch('user:admin:');

// Count by prefix
function countPrefix(prefix) {
  return kvStore.prefixSearch(prefix).length;
}

// Delete by prefix
function deleteByPrefix(prefix) {
  const keys = kvStore.prefixSearch(prefix);
  keys.forEach(key => kvStore.delete(key));
}
```

---

### `regexSearch(pattern)`

Find keys matching a regular expression.

**Signature:**
```javascript
regexSearch(pattern: string): string[]
```

**Parameters:**
- `pattern` (string, required): Regular expression pattern

**Returns:**
- Array of matching keys

**Examples:**

```javascript
// Numeric user IDs
const users = kvStore.regexSearch('^user:\\d+$');
// ['user:1', 'user:2', 'user:100']

// Email-like keys
const emails = kvStore.regexSearch('.*@.*\\.com$');

// Session tokens (alphanumeric)
const sessions = kvStore.regexSearch('^session:[a-z0-9]{32}$');

// Date patterns
const logs = kvStore.regexSearch('^log:2025-\\d{2}-\\d{2}');

// Complex patterns
const pattern = '^(user|admin):.*:(active|pending)$';
const matches = kvStore.regexSearch(pattern);

// Case-insensitive search
function caseInsensitiveSearch(pattern) {
  const allKeys = kvStore.keys();
  const regex = new RegExp(pattern, 'i');
  return allKeys.filter(k => regex.test(k));
}
```

---

### `rangeQuery(start, end)`

Find keys within a lexicographic range.

**Signature:**
```javascript
rangeQuery(start: string, end: string): string[]
```

**Parameters:**
- `start` (string, required): Range start (inclusive)
- `end` (string, required): Range end (inclusive)

**Returns:**
- Sorted array of keys in range

**Examples:**

```javascript
// User ID range
const range = kvStore.rangeQuery('user:100', 'user:200');
// ['user:100', 'user:150', 'user:200']

// Date range
const logs = kvStore.rangeQuery(
  'log:2025-01-01',
  'log:2025-01-31'
);

// Alphabetical range
const names = kvStore.rangeQuery('name:A', 'name:M');

// Price range (with padding)
const products = kvStore.rangeQuery(
  'price:0000100',
  'price:0001000'
);

// Time-based queries
function getLogsForDay(date) {
  return kvStore.rangeQuery(
    `log:${date}:00:00:00`,
    `log:${date}:23:59:59`
  );
}
```

---

### `keysBySize(limit)`

Get largest keys by value size.

**Signature:**
```javascript
keysBySize(limit?: number): Array<{ key: string, size: number }>
```

**Parameters:**
- `limit` (number, optional): Number of results. Default: 10

**Returns:**
- Array of objects with `key` and `size` (in bytes)

**Examples:**

```javascript
// Top 10 largest keys
const largest = kvStore.keysBySize(10);
console.log(largest);
// [
//   { key: 'data:big', size: 15234 },
//   { key: 'cache:large', size: 12456 },
//   ...
// ]

// Find all large keys
const largeKeys = kvStore.keysBySize(100)
  .filter(item => item.size > 10000);

// Storage optimization
function cleanupLargeKeys(threshold = 10000) {
  const large = kvStore.keysBySize(1000)
    .filter(item => item.size > threshold);
  
  large.forEach(item => {
    console.log(`Large key: ${item.key} (${item.size} bytes)`);
    if (confirm(`Delete ${item.key}?`)) {
      kvStore.delete(item.key);
    }
  });
}

// Total size of largest keys
const total = kvStore.keysBySize(10)
  .reduce((sum, item) => sum + item.size, 0);
console.log('Total size:', total, 'bytes');
```

---

### `advancedQuery(type, pattern)`

Unified query interface.

**Signature:**
```javascript
advancedQuery(
  type: 'prefix' | 'regex' | 'range' | 'size',
  pattern: string
): string[] | Array<{ key: string, size: number }>
```

**Parameters:**
- `type` (string, required): Query type
- `pattern` (string, required): Query pattern

**Returns:**
- Query results (type depends on query type)

**Examples:**

```javascript
// Prefix query
const users = kvStore.advancedQuery('prefix', 'user:');

// Regex query
const sessions = kvStore.advancedQuery('regex', '^session:[a-z]{3}$');

// Range query
const logs = kvStore.advancedQuery('range', 'log:2025-01,log:2025-02');

// Size query
const largest = kvStore.advancedQuery('size', '10');

// Query builder
class QueryBuilder {
  constructor(store) {
    this.store = store;
  }
  
  prefix(prefix) {
    return this.store.advancedQuery('prefix', prefix);
  }
  
  regex(pattern) {
    return this.store.advancedQuery('regex', pattern);
  }
  
  range(start, end) {
    return this.store.advancedQuery('range', `${start},${end}`);
  }
  
  topSize(limit) {
    return this.store.advancedQuery('size', limit.toString());
  }
}

const query = new QueryBuilder(kvStore);
const results = query.prefix('user:').filter(k => k.includes('admin'));
```

---

## Import/Export

### `export(format)`

Export all data in specified format.

**Signature:**
```javascript
export(format?: 'json' | 'csv' | 'txt'): string
```

**Parameters:**
- `format` (string, optional): Export format. Default: 'json'

**Returns:**
- String containing exported data

**Examples:**

```javascript
// Export to JSON
const jsonData = kvStore.export('json');
console.log(jsonData);
// [
//   {"key": "user:1", "value": "Alice", "timestamp": 1234567890, ...},
//   ...
// ]

// Export to CSV
const csvData = kvStore.export('csv');
// Key,Value,Timestamp,Encrypted,TTL
// "user:1","Alice","1234567890",false,null
// ...

// Export to plain text
const txtData = kvStore.export('txt');
// user:1 = Alice
// user:2 = Bob
// ...

// Save to file
function downloadExport(format = 'json') {
  const data = kvStore.export(format);
  const blob = new Blob([data], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kvstore-${Date.now()}.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

// Backup before clear
const backup = kvStore.export('json');
localStorage.setItem('kvstore-backup', backup);
kvStore.clear();
```

---

### `import(data, format)`

Import data from string.

**Signature:**
```javascript
import(
  data: string,
  format?: 'json' | 'csv' | 'txt'
): {
  success: boolean,
  imported: number,
  total: number,
  error?: string
}
```

**Parameters:**
- `data` (string, required): Data to import
- `format` (string, optional): Data format. Default: 'json'

**Returns:**
- Object with import results

**Examples:**

```javascript
// Import JSON
const jsonData = `[
  {"key": "user:1", "value": "Alice"},
  {"key": "user:2", "value": "Bob", "ttl": 3600}
]`;
const result = kvStore.import(jsonData, 'json');
console.log(result);
// { success: true, imported: 2, total: 2 }

// Import CSV
const csvData = `Key,Value,Timestamp,Encrypted,TTL
"user:1","Alice","1234567890",false,null
"user:2","Bob","1234567891",false,3600`;
kvStore.import(csvData, 'csv');

// Import from file
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const reader = new FileReader();
  reader.onload = (event) => {
    const format = file.name.split('.').pop();
    const result = kvStore.import(event.target.result, format);
    console.log(`Imported ${result.imported}/${result.total} entries`);
  };
  reader.readAsText(file);
});

// Merge import
function mergeImport(data, format) {
  const backup = kvStore.export('json');
  const result = kvStore.import(data, format);
  if (!result.success) {
    kvStore.import(backup, 'json'); // Rollback
  }
  return result;
}

// Restore backup
const backup = localStorage.getItem('kvstore-backup');
if (backup) {
  kvStore.import(backup, 'json');
}
```

---

## Statistics & Monitoring

### `getStats()`

Get comprehensive statistics.

**Signature:**
```javascript
getStats(): {
  totalKeys: number,
  totalOps: number,
  putOps: number,
  getOps: number,
  deleteOps: number,
  avgLatency: string,
  cacheHitRate: string,
  storageSize: string,
  encryptedKeys: number,
  opsPerSecond: number,
  cacheSize: number
}
```

**Returns:**
- Object with all statistics

**Examples:**

```javascript
// Get stats
const stats = kvStore.getStats();
console.log(stats);

// Monitor performance
setInterval(() => {
  const stats = kvStore.getStats();
  console.log('Ops/sec:', stats.opsPerSecond);
  console.log('Cache hit rate:', stats.cacheHitRate + '%');
  console.log('Avg latency:', stats.avgLatency + 'ms');
}, 1000);

// Performance alert
function checkPerformance() {
  const stats = kvStore.getStats();
  if (parseFloat(stats.cacheHitRate) < 80) {
    console.warn('Low cache hit rate!');
  }
  if (parseFloat(stats.avgLatency) > 5) {
    console.warn('High latency!');
  }
}

// Generate report
function generateReport() {
  const stats = kvStore.getStats();
  return `
    Performance Report
    ==================
    Total Keys: ${stats.totalKeys}
    Total Operations: ${stats.totalOps}
    - PUT: ${stats.putOps}
    - GET: ${stats.getOps}
    - DELETE: ${stats.deleteOps}
    
    Performance:
    - Avg Latency: ${stats.avgLatency}ms
    - Cache Hit Rate: ${stats.cacheHitRate}%
    - Ops/Second: ${stats.opsPerSecond}
    
    Storage:
    - Size: ${stats.storageSize} KB
    - Encrypted Keys: ${stats.encryptedKeys}
    - Cache Size: ${stats.cacheSize}
  `;
}
```

---

### `analyze()`

Deep analysis of storage.

**Signature:**
```javascript
analyze(): {
  totalKeys: number,
  totalSize: number,
  averageKeySize: number,
  averageValueSize: number,
  encryptedKeys: number,
  expiredKeys: number,
  largestKeys: Array<{ key: string, size: number }>,
  keyPrefixes: Array<{ prefix: string, count: number }>
}
```

**Returns:**
- Object with detailed analysis

**Examples:**

```javascript
// Full analysis
const analysis = kvStore.analyze();
console.log(analysis);

// Storage optimization
function optimizeStorage() {
  const analysis = kvStore.analyze();
  
  // Remove expired
  console.log('Expired keys:', analysis.expiredKeys);
  
  // Large keys
  console.log('Largest keys:');
  analysis.largestKeys.forEach(item => {
    console.log(`  ${item.key}: ${item.size} bytes`);
  });
  
  // Prefix distribution
  console.log('Key distribution:');
  analysis.keyPrefixes.forEach(item => {
    console.log(`  ${item.prefix}: ${item.count} keys`);
  });
}

// Size report
function sizeReport() {
  const analysis = kvStore.analyze();
  const sizeInKB = (analysis.totalSize / 1024).toFixed(2);
  const avgKeySize = analysis.averageKeySize.toFixed(2);
  const avgValueSize = analysis.averageValueSize.toFixed(2);
  
  console.log(`Total: ${sizeInKB} KB`);
  console.log(`Avg key: ${avgKeySize} bytes`);
  console.log(`Avg value: ${avgValueSize} bytes`);
}
```

---

## Cache Management

### Cache Properties

```javascript
// Cache size (default: 100)
kvStore.cacheSize = 100;

// Current cache size
console.log(kvStore.cache.size);

// Check cache
console.log(kvStore.cache.has('user:123'));

// Clear cache (not store)
kvStore.cache.clear();
```

### Monitoring

```javascript
// Start monitoring
kvStore.startMonitoring();

// Stop monitoring  
kvStore.stopMonitoring();

// Enable/disable
kvStore.monitoring.enabled = false;
```

---

## Utility Methods

### Helper Functions

```javascript
// Get all entries
const entries = kvStore.getAllEntries();
// [
//   { key: 'user:1', value: 'Alice', timestamp: 123, encrypted: false, ttl: null },
//   ...
// ]

// Reset statistics
kvStore.resetStats();

// Check encrypted key
kvStore.encryptedKeys.has('secret:key');

// Get WAL size
console.log(kvStore.wal.length);

// Direct store access
console.log(kvStore.store.size);

// Query history
console.log(kvStore.queryHistory);
```

---

## Error Handling

### Best Practices

```javascript
// Wrap operations in try-catch
try {
  kvStore.put('key', 'value');
} catch (error) {
  console.error('Operation failed:', error);
}

// Validate before operation
function safePut(key, value) {
  if (!key || value === undefined) {
    throw new Error('Invalid key or value');
  }
  return kvStore.put(key, value);
}

// Check quota
function checkQuota() {
  try {
    const testKey = '__quota_test__';
    kvStore.put(testKey, 'x'.repeat(1000000));
    kvStore.delete(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

// Graceful degradation
function putWithFallback(key, value) {
  try {
    return kvStore.put(key, value);
  } catch (error) {
    console.warn('Store failed, using memory only');
    window.tempStore = window.tempStore || {};
    window.tempStore[key] = value;
    return { success: true, latency: "0" };
  }
}
```

---

## Performance Tips

1. **Use batch operations** for multiple writes
2. **Enable caching** for frequently accessed keys
3. **Set TTL** for temporary data
4. **Monitor cache hit rate** (aim for 90%+)
5. **Use prefix patterns** for related keys
6. **Compress large values**
7. **Analyze storage** regularly
8. **Clear expired keys** periodically

---

## Complete Example

```javascript
// Initialize
const store = new TinyKVStorePro();

// Store user data
store.put('user:001', JSON.stringify({
  name: 'Alice',
  email: 'alice@example.com',
  role: 'admin'
}));

// Store session with TTL
store.put('session:abc123', 'user:001', { ttl: 3600 });

// Store encrypted password
store.putEncrypted('user:001:password', 'SecurePass123!');

// Batch operations
store.batch([
  { op: 'PUT', key: 'product:1', value: 'Laptop' },
  { op: 'PUT', key: 'product:2', value: 'Mouse' },
  { op: 'PUT', key: 'product:3', value: 'Keyboard' }
]);

// Query products
const products = store.prefixSearch('product:');

// Get statistics
const stats = store.getStats();
console.log('Performance:', stats);

// Export backup
const backup = store.export('json');
localStorage.setItem('backup', backup);

// Analyze storage
const analysis = store.analyze();
console.log('Analysis:', analysis);
```

---

**End of API Documentation**