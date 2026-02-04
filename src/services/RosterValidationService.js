/**
 * 花名册校验服务
 * 负责校验用户注册时是否在员工名单或嘉宾名单中
 */

const fs = require('fs');
const path = require('path');
const { getDatabase } = require('../database/init');

class RosterValidationService {
  constructor() {
    this.rosterConfigPath = path.join(__dirname, '../../config/employee-roster.json');
    this.employeeRoster = new Map(); // 格式: "name_gender" -> employee data
    this.lastRosterLoad = 0;
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存

    // 启动时加载一次
    this.loadEmployeeRoster().catch(err => {
      console.error('Failed to load initial employee roster:', err);
    });
  }

  /**
   * 加载员工名单配置文件
   */
  async loadEmployeeRoster() {
    return new Promise((resolve, reject) => {
      // 检查缓存
      const now = Date.now();
      if (this.employeeRoster.size > 0 && (now - this.lastRosterLoad) < this.cacheExpiry) {
        return resolve(this.employeeRoster);
      }

      fs.readFile(this.rosterConfigPath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error loading employee roster:', err);
          // 如果配置文件不存在，使用空列表
          this.employeeRoster.clear();
          this.lastRosterLoad = now;
          return resolve(this.employeeRoster);
        }

        try {
          const config = JSON.parse(data);
          this.employeeRoster.clear();

          // 构建快速查找索引: "name_gender" -> employee data
          if (config.employees && Array.isArray(config.employees)) {
            config.employees.forEach(emp => {
              const key = `${emp.name.toLowerCase()}_${emp.gender}`;
              this.employeeRoster.set(key, {
                sequence: emp.sequence,
                name: emp.name,
                gender: emp.gender
              });
            });
          }

          this.lastRosterLoad = now;
          console.log(`✓ Employee roster loaded: ${this.employeeRoster.size} employees`);
          resolve(this.employeeRoster);
        } catch (parseErr) {
          console.error('Error parsing employee roster JSON:', parseErr);
          this.employeeRoster.clear();
          this.lastRosterLoad = now;
          reject(parseErr);
        }
      });
    });
  }

  /**
   * 从数据库获取嘉宾列表
   */
  async getGuestsFromDatabase() {
    return new Promise((resolve, reject) => {
      const db = getDatabase();

      const sql = `
        SELECT id, name, gender, source, added_by, notes, created_at
        FROM guests
        ORDER BY created_at DESC
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('Error fetching guests from database:', err);
          db.close();
          return resolve([]);
        }

        db.close();
        resolve(rows || []);
      });
    });
  }

  /**
   * 检查是否在员工名单中
   */
  async isInEmployeeRoster(name, gender) {
    await this.loadEmployeeRoster();
    const key = `${name.toLowerCase()}_${gender}`;
    return this.employeeRoster.has(key);
  }

  /**
   * 检查是否在嘉宾表中
   */
  async isInGuestTable(name, gender) {
    const guests = await this.getGuestsFromDatabase();
    return guests.some(guest =>
      guest.name.toLowerCase() === name.toLowerCase() &&
      guest.gender === gender
    );
  }

  /**
   * 校验注册是否有效（在员工名单或嘉宾表中）
   * @param {string} name - 姓名
   * @param {string} gender - 性别 (male/female)
   * @returns {Promise<Object>} 校验结果
   */
  async validateRegistration(name, gender) {
    try {
      // 基本参数验证
      if (!name || !name.trim()) {
        return {
          valid: false,
          source: 'unknown',
          canProceedAsGuest: true,
          message: '姓名不能为空'
        };
      }

      if (!gender || !['male', 'female'].includes(gender)) {
        return {
          valid: false,
          source: 'unknown',
          canProceedAsGuest: true,
          message: '性别无效'
        };
      }

      const normalizedName = name.trim();

      // 检查是否在员工名单中
      const isEmployee = await this.isInEmployeeRoster(normalizedName, gender);

      if (isEmployee) {
        return {
          valid: true,
          source: 'employee',
          canProceedAsGuest: false,
          message: '验证通过'
        };
      }

      // 检查是否在嘉宾表中
      const isGuest = await this.isInGuestTable(normalizedName, gender);

      if (isGuest) {
        return {
          valid: true,
          source: 'guest',
          canProceedAsGuest: false,
          message: '验证通过（嘉宾）'
        };
      }

      // 都不在，返回警告但允许继续
      return {
        valid: false,
        source: 'unknown',
        canProceedAsGuest: true,
        message: '您当前输入的姓名/性别不在公司花名册中，请确认是否正确，使用非真实姓名可能会导致投票无效，如您是嘉宾，请正常注册，继续参加活动。'
      };
    } catch (error) {
      console.error('Error validating registration:', error);
      // 出错时默认允许注册（避免阻塞用户）
      return {
        valid: false,
        source: 'unknown',
        canProceedAsGuest: true,
        message: '验证服务暂时不可用，您可以继续注册'
      };
    }
  }

  /**
   * 获取注册来源（员工/嘉宾/未知）
   */
  async getRegistrationSource(name, gender) {
    const normalizedName = name.trim();

    const isEmployee = await this.isInEmployeeRoster(normalizedName, gender);
    if (isEmployee) return 'employee';

    const isGuest = await this.isInGuestTable(normalizedName, gender);
    if (isGuest) return 'guest';

    return 'unknown';
  }

  /**
   * 获取所有合法注册者统计信息
   */
  async getStatistics() {
    try {
      await this.loadEmployeeRoster();
      const guests = await this.getGuestsFromDatabase();

      const maleEmployees = Array.from(this.employeeRoster.values()).filter(e => e.gender === 'male').length;
      const femaleEmployees = Array.from(this.employeeRoster.values()).filter(e => e.gender === 'female').length;
      const maleGuests = guests.filter(g => g.gender === 'male').length;
      const femaleGuests = guests.filter(g => g.gender === 'female').length;

      return {
        employees: {
          total: this.employeeRoster.size,
          male: maleEmployees,
          female: femaleEmployees
        },
        guests: {
          total: guests.length,
          male: maleGuests,
          female: femaleGuests
        },
        total: this.employeeRoster.size + guests.length
      };
    } catch (error) {
      console.error('Error getting roster statistics:', error);
      return {
        employees: { total: 0, male: 0, female: 0 },
        guests: { total: 0, male: 0, female: 0 },
        total: 0
      };
    }
  }

  /**
   * 刷新缓存
   */
  async refreshCache() {
    this.lastRosterLoad = 0;
    await this.loadEmployeeRoster();
    console.log('✓ Roster validation cache refreshed');
  }

  /**
   * 获取员工名单（用于调试）
   */
  async getEmployeeList() {
    await this.loadEmployeeRoster();
    return Array.from(this.employeeRoster.values());
  }
}

// 导出单例
const rosterValidationService = new RosterValidationService();

module.exports = rosterValidationService;
