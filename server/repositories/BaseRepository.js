const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebaseConfig');

class BaseRepository {
    /**
     * @param {string} collectionName - Firestore collection name
     * @param {string} localFileName - Local JSON filename (e.g., 'patients.json')
     */
    constructor(collectionName, localFileName) {
        this.collectionName = collectionName;
        this.localFilePath = path.join(__dirname, '../data', localFileName);
    }

    // --- Local File Helpers ---

    _readLocal() {
        try {
            if (!fs.existsSync(this.localFilePath)) return [];
            const data = fs.readFileSync(this.localFilePath, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            console.error(`Error reading local data from ${this.localFilePath}:`, e);
            return [];
        }
    }

    _writeLocal(data) {
        try {
            fs.writeFileSync(this.localFilePath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`Error writing local data to ${this.localFilePath}:`, e);
        }
    }

    // --- CRUD Operations ---

    async findAll() {
        try {
            if (db) {
                try {
                    const snapshot = await db.collection(this.collectionName).get();
                    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                } catch (fsError) {
                    console.error(`Firestore Error in findAll [${this.collectionName}] (Fallback to Local):`, fsError.message);
                    return this._readLocal();
                }
            } else {
                return this._readLocal();
            }
        } catch (error) {
            console.error(`BaseRepository findAll error [${this.collectionName}]:`, error);
            throw error;
        }
    }

    async findById(id) {
        try {
            if (db) {
                try {
                    const doc = await db.collection(this.collectionName).doc(String(id)).get();
                    if (!doc.exists) return null;
                    return { id: doc.id, ...doc.data() };
                } catch (fsError) {
                    console.error(`Firestore Error in findById [${this.collectionName}] (Fallback to Local):`, fsError.message);
                    const items = this._readLocal();
                    return items.find(item => String(item.id) === String(id)) || null;
                }
            } else {
                const items = this._readLocal();
                return items.find(item => String(item.id) === String(id)) || null;
            }
        } catch (error) {
            console.error(`BaseRepository findById error [${this.collectionName}]:`, error);
            throw error;
        }
    }

    async create(data) {
        try {
            if (db) {
                try {
                    // Start simple: just add. Subclasses might override if they need manual ID generation for Firestore too.
                    const docRef = await db.collection(this.collectionName).add(data);
                    return { id: docRef.id, ...data };
                } catch (fsError) {
                    console.error(`Firestore Error in create [${this.collectionName}] (Fallback to Local):`, fsError.message);
                    return this._createLocal(data);
                }
            } else {
                return this._createLocal(data);
            }
        } catch (error) {
            console.error(`BaseRepository create error [${this.collectionName}]:`, error);
            throw error;
        }
    }

    _createLocal(data) {
        const items = this._readLocal();
        // Simple numeric ID generation for local mode, matching old behavior
        // If items use UUIDs, this might need adjustment, but legacy data uses simple ints usually.
        const newId = items.length > 0 ? Math.max(...items.map(i => parseInt(i.id) || 0)) + 1 : 1;
        const newItem = { ...data, id: newId };
        items.push(newItem);
        this._writeLocal(items);
        return newItem;
    }

    async update(id, data) {
        try {
            if (db) {
                try {
                    await db.collection(this.collectionName).doc(String(id)).update(data);
                    return { id, ...data };
                } catch (fsError) {
                    console.error(`Firestore Error in update [${this.collectionName}] (Fallback to Local):`, fsError.message);
                    return this._updateLocal(id, data);
                }
            } else {
                return this._updateLocal(id, data);
            }
        } catch (error) {
            console.error(`BaseRepository update error [${this.collectionName}]:`, error);
            throw error;
        }
    }

    _updateLocal(id, data) {
        const items = this._readLocal();
        const index = items.findIndex(item => String(item.id) === String(id));
        if (index === -1) return null;

        items[index] = { ...items[index], ...data };
        this._writeLocal(items);
        return items[index];
    }

    async delete(id) {
        try {
            if (db) {
                try {
                    await db.collection(this.collectionName).doc(String(id)).delete();
                    return true;
                } catch (fsError) {
                    console.error(`Firestore Error in delete [${this.collectionName}] (Fallback to Local):`, fsError.message);
                    return this._deleteLocal(id);
                }
            } else {
                return this._deleteLocal(id);
            }
        } catch (error) {
            console.error(`BaseRepository delete error [${this.collectionName}]:`, error);
            throw error;
        }
    }

    _deleteLocal(id) {
        let items = this._readLocal();
        const initialLength = items.length;
        items = items.filter(item => String(item.id) !== String(id));
        if (items.length === initialLength) return false;
        this._writeLocal(items);
        return true;
    }
}

module.exports = BaseRepository;
