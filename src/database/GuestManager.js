/**
 * 嘉宾管理器
 * 负责嘉宾信息的CRUD操作
 */

const { getDatabase, releaseConnection } = require('./init');
const { v4: uuidv4 } = require('uuid');

class GuestManager {
  /**
   * 添加嘉宾
   * @param {Object} guestData - 嘉宾数据 { name, gender, notes, source, addedBy }
   * @returns {Promise<Object>} 创建的嘉宾记录
   */
  async addGuest(guestData) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();
      const { name, gender, notes, source = 'admin', addedBy } = guestData;

      // 验证参数
      if (!name || !name.trim()) {
        releaseConnection(db);
        return reject(new Error('嘉宾姓名不能为空'));
      }

      if (!gender || !['male', 'female'].includes(gender)) {
        releaseConnection(db);
        return reject(new Error('性别必须为 male 或 female'));
      }

      const id = uuidv4();
      const sql = `
        INSERT INTO guests (id, name, gender, source, added_by, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [id, name.trim(), gender, source, addedBy, notes || null], function(err) {
        releaseConnection(db);

        if (err) {
          // 唯一约束冲突（姓名+性别重复）
          if (err.message.includes('UNIQUE constraint failed')) {
            return reject(new Error('该姓名和性别的组合已存在'));
          }
          return reject(err);
        }

        resolve({
          id,
          name: name.trim(),
          gender,
          source,
          addedBy,
          notes,
          createdAt: new Date().toISOString()
        });
      });
    });
  }

  /**
   * 获取所有嘉宾（支持分页和过滤）
   * @param {Object} options - 选项 { page, limit, name, gender, source }
   * @returns {Promise<Object>} 嘉宾列表和总数
   */
  async getGuests(options = {}) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();
      const {
        page = 1,
        limit = 50,
        name,
        gender,
        source
      } = options;

      const offset = (page - 1) * limit;
      const conditions = [];
      const params = [];

      // 构建查询条件
      if (name) {
        conditions.push('name LIKE ?');
        params.push(`%${name}%`);
      }

      if (gender) {
        conditions.push('gender = ?');
        params.push(gender);
      }

      if (source) {
        conditions.push('source = ?');
        params.push(source);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 查询总数
      const countSql = `SELECT COUNT(*) as total FROM guests ${whereClause}`;

      // 查询数据
      const dataSql = `
        SELECT id, name, gender, source, added_by, notes, created_at, updated_at
        FROM guests
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      db.get(countSql, params, (err, countResult) => {
        if (err) {
          releaseConnection(db);
          return reject(err);
        }

        const total = countResult.total;

        db.all(dataSql, [...params, limit, offset], (err, rows) => {
          releaseConnection(db);

          if (err) {
            return reject(err);
          }

          resolve({
            guests: rows || [],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          });
        });
      });
    });
  }

  /**
   * 根据ID获取嘉宾
   * @param {string} id - 嘉宾ID
   * @returns {Promise<Object>} 嘉宾记录
   */
  async getGuestById(id) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();

      const sql = `
        SELECT id, name, gender, source, added_by, notes, created_at, updated_at
        FROM guests
        WHERE id = ?
      `;

      db.get(sql, [id], (err, row) => {
        releaseConnection(db);

        if (err) {
          return reject(err);
        }

        if (!row) {
          return reject(new Error('嘉宾不存在'));
        }

        resolve(row);
      });
    });
  }

  /**
   * 更新嘉宾信息
   * @param {string} id - 嘉宾ID
   * @param {Object} updateData - 更新数据 { name, gender, notes }
   * @returns {Promise<Object>} 更新后的嘉宾记录
   */
  async updateGuest(id, updateData) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();
      const { name, gender, notes } = updateData;

      // 验证参数
      if (name !== undefined && !name?.trim()) {
        releaseConnection(db);
        return reject(new Error('嘉宾姓名不能为空'));
      }

      if (gender && !['male', 'female'].includes(gender)) {
        releaseConnection(db);
        return reject(new Error('性别必须为 male 或 female'));
      }

      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name.trim());
      }

      if (gender !== undefined) {
        updates.push('gender = ?');
        params.push(gender);
      }

      if (notes !== undefined) {
        updates.push('notes = ?');
        params.push(notes);
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `
        UPDATE guests
        SET ${updates.join(', ')}
        WHERE id = ?
      `;

      db.run(sql, params, function(err) {
        releaseConnection(db);

        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return reject(new Error('该姓名和性别的组合已存在'));
          }
          return reject(err);
        }

        if (this.changes === 0) {
          return reject(new Error('嘉宾不存在'));
        }

        resolve({
          id,
          ...updateData,
          updatedAt: new Date().toISOString()
        });
      });
    });
  }

  /**
   * 删除嘉宾
   * @param {string} id - 嘉宾ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteGuest(id) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();

      const sql = `DELETE FROM guests WHERE id = ?`;

      db.run(sql, [id], function(err) {
        releaseConnection(db);

        if (err) {
          return reject(err);
        }

        if (this.changes === 0) {
          return reject(new Error('嘉宾不存在'));
        }

        resolve(true);
      });
    });
  }

  /**
   * 检查嘉宾是否存在
   * @param {string} name - 姓名
   * @param {string} gender - 性别
   * @returns {Promise<boolean>} 是否存在
   */
  async guestExists(name, gender) {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();

      const sql = `
        SELECT id FROM guests
        WHERE LOWER(name) = LOWER(?) AND gender = ?
      `;

      db.get(sql, [name.trim(), gender], (err, row) => {
        releaseConnection(db);

        if (err) {
          return reject(err);
        }

        resolve(!!row);
      });
    });
  }

  /**
   * 批量导入嘉宾
   * @param {Array} guestsList - 嘉宾列表 [{ name, gender, notes }]
   * @param {string} addedBy - 添加者ID
   * @returns {Promise<Object>} 导入结果 { success, failed, results }
   */
  async bulkImportGuests(guestsList, addedBy) {
    const results = {
      success: [],
      failed: [],
      total: guestsList.length
    };

    for (const guestData of guestsList) {
      try {
        const guest = await this.addGuest({
          name: guestData.name,
          gender: guestData.gender,
          notes: guestData.notes,
          source: 'admin',
          addedBy
        });
        results.success.push(guest);
      } catch (error) {
        results.failed.push({
          data: guestData,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 获取嘉宾统计信息
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics() {
    return new Promise(async (resolve, reject) => {
      const db = await getDatabase();

      const sql = `
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male,
          SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female,
          SUM(CASE WHEN source = 'admin' THEN 1 ELSE 0 END) as adminAdded,
          SUM(CASE WHEN source = 'self' THEN 1 ELSE 0 END) as selfAdded
        FROM guests
      `;

      db.get(sql, [], (err, row) => {
        releaseConnection(db);

        if (err) {
          return reject(err);
        }

        resolve({
          total: row.total || 0,
          male: row.male || 0,
          female: row.female || 0,
          adminAdded: row.adminAdded || 0,
          selfAdded: row.selfAdded || 0
        });
      });
    });
  }
}

// 导出单例
const guestManager = new GuestManager();

module.exports = guestManager;
