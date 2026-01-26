const { getDatabase } = require('./init');
const { v4: uuidv4 } = require('uuid');

/**
 * Database operation utility functions for the annual party voting system
 * Implements user CRUD operations, voting operations, and vote restrictions
 */

// ==================== NUMERIC ID OPERATIONS ====================

// ==================== USER OPERATIONS ====================

/**
 * Create a new user
 * @param {Object} userData - User data object
 * @param {string} userData.name - User's name
 * @param {string} userData.gender - User's gender ('male' or 'female')
 * @param {string} [userData.avatarUrl] - Optional avatar URL
 * @param {string} [userData.qrCode] - Optional QR code data
 * @returns {Promise<Object>} Created user object with ID and numeric ID
 */
async function createUser(userData) {
  return new Promise(async (resolve, reject) => {
    const db = getDatabase();
    const userId = uuidv4();
    const { name, gender, avatarUrl = null, qrCode = null } = userData;
    
    // Validate required fields
    if (!name || !name.trim()) {
      db.close();
      return reject(new Error('Name is required and cannot be empty'));
    }
    
    if (!gender || !['male', 'female'].includes(gender)) {
      db.close();
      return reject(new Error('Gender must be either "male" or "female"'));
    }
    
    try {
      // Check if numeric_id column exists by querying table info
      const hasNumericIdColumn = await new Promise((resolve, reject) => {
        const checkDb = getDatabase();
        checkDb.all("PRAGMA table_info(users)", (err, columns) => {
          checkDb.close();
          if (err) return reject(err);
          resolve(columns.some(col => col.name === 'numeric_id'));
        });
      });
      
      let numericId = null;
      let insertSuccess = false;
      let attempts = 0;
      const maxAttempts = 10;
      
      // If numeric_id column exists, generate unique ID with retry logic
      if (hasNumericIdColumn) {
        while (!insertSuccess && attempts < maxAttempts) {
          attempts++;
          
          // Generate a new numeric ID for each attempt
          numericId = Math.floor(Math.random() * 900000 + 100000).toString();
          
          try {
            // Try to insert with the generated numeric ID
            const sql = `
              INSERT INTO users (id, numeric_id, name, gender, avatar_url, qr_code, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;
            const params = [userId, numericId, name.trim(), gender, avatarUrl, qrCode];
            
            await new Promise((resolve, reject) => {
              db.run(sql, params, function(err) {
                if (err) {
                  // Check if it's a unique constraint violation for numeric_id
                  if (err.message && err.message.includes('UNIQUE constraint failed: users.numeric_id')) {
                    // This numeric ID is already taken, try again
                    return resolve(false);
                  }
                  // Other error, reject
                  return reject(err);
                }
                // Success
                resolve(true);
              });
            });
            
            insertSuccess = true;
            
          } catch (error) {
            if (attempts >= maxAttempts) {
              db.close();
              return reject(new Error(`Failed to generate unique numeric ID after ${maxAttempts} attempts: ${error.message}`));
            }
            // Continue to next attempt
          }
        }
        
        if (!insertSuccess) {
          db.close();
          return reject(new Error(`Failed to generate unique numeric ID after ${maxAttempts} attempts`));
        }
        
      } else {
        // No numeric_id column, insert without it
        const sql = `
          INSERT INTO users (id, name, gender, avatar_url, qr_code, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;
        const params = [userId, name.trim(), gender, avatarUrl, qrCode];
        
        await new Promise((resolve, reject) => {
          db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve();
          });
        });
      }
      
      db.close();
      
      resolve({
        id: userId,
        numericId: hasNumericIdColumn ? numericId : null,
        name: name.trim(),
        gender,
        avatarUrl,
        qrCode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      db.close();
      reject(error);
    }
  });
}

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserById(userId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    // First check if numeric_id column exists
    db.all("PRAGMA table_info(users)", (err, columns) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      const hasNumericId = columns.some(col => col.name === 'numeric_id');
      
      let sql;
      if (hasNumericId) {
        sql = `
          SELECT u.*, 
                 COUNT(v.id) as vote_count
          FROM users u
          LEFT JOIN votes v ON u.id = v.target_user_id
          WHERE u.id = ?
          GROUP BY u.id
        `;
      } else {
        sql = `
          SELECT u.id, u.name, u.gender, u.avatar_url, u.qr_code, u.created_at, u.updated_at,
                 COUNT(v.id) as vote_count
          FROM users u
          LEFT JOIN votes v ON u.id = v.target_user_id
          WHERE u.id = ?
          GROUP BY u.id
        `;
      }
      
      db.get(sql, [userId], (err, row) => {
        db.close();
        
        if (err) {
          return reject(err);
        }
        
        if (!row) {
          return resolve(null);
        }
        
        resolve({
          id: row.id,
          numericId: hasNumericId ? row.numeric_id : null,
          name: row.name,
          gender: row.gender,
          avatarUrl: row.avatar_url,
          qrCode: row.qr_code,
          voteCount: row.vote_count || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      });
    });
  });
}

/**
 * Get user by numeric ID
 * @param {string} numericId - 6-digit numeric ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserByNumericId(numericId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    if (!numericId || !numericId.toString().trim()) {
      db.close();
      return reject(new Error('Numeric ID is required'));
    }
    
    // Validate numeric ID format (6 digits)
    const numericIdStr = numericId.toString().trim();
    if (!/^\d{6}$/.test(numericIdStr)) {
      db.close();
      return reject(new Error('Numeric ID must be exactly 6 digits'));
    }
    
    const sql = `
      SELECT u.*, 
             COUNT(v.id) as vote_count
      FROM users u
      LEFT JOIN votes v ON u.id = v.target_user_id
      WHERE u.numeric_id = ?
      GROUP BY u.id
    `;
    
    db.get(sql, [numericIdStr], (err, row) => {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      if (!row) {
        return resolve(null);
      }
      
      resolve({
        id: row.id,
        numericId: row.numeric_id,
        name: row.name,
        gender: row.gender,
        avatarUrl: row.avatar_url,
        qrCode: row.qr_code,
        voteCount: row.vote_count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    });
  });
}

/**
 * Update user information
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @param {string} [updateData.name] - New name
 * @param {string} [updateData.avatarUrl] - New avatar URL
 * @param {string} [updateData.qrCode] - New QR code data
 * @returns {Promise<Object>} Updated user object
 */
async function updateUser(userId, updateData) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    if (updateData.name !== undefined) {
      if (!updateData.name || !updateData.name.trim()) {
        db.close();
        return reject(new Error('Name cannot be empty'));
      }
      updateFields.push('name = ?');
      updateValues.push(updateData.name.trim());
    }
    
    if (updateData.avatarUrl !== undefined) {
      updateFields.push('avatar_url = ?');
      updateValues.push(updateData.avatarUrl);
    }
    
    if (updateData.qrCode !== undefined) {
      updateFields.push('qr_code = ?');
      updateValues.push(updateData.qrCode);
    }
    
    if (updateFields.length === 0) {
      db.close();
      return reject(new Error('No fields to update'));
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(userId);
    
    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.run(sql, updateValues, function(err) {
      if (err) {
        db.close();
        return reject(err);
      }
      
      if (this.changes === 0) {
        db.close();
        return reject(new Error('User not found'));
      }
      
      // Get updated user
      getUserById(userId)
        .then(resolve)
        .catch(reject);
    });
  });
}

/**
 * Delete user by ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteUser(userId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Delete related votes first
      db.run('DELETE FROM votes WHERE target_user_id = ? OR voter_id = ?', [userId, userId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          db.close();
          return reject(err);
        }
      });
      
      // Delete vote restrictions
      db.run('DELETE FROM vote_restrictions WHERE voter_id = ? OR male_voted_user_id = ? OR female_voted_user_id = ?', 
        [userId, userId, userId], (err) => {
        if (err) {
          db.run('ROLLBACK');
          db.close();
          return reject(err);
        }
      });
      
      // Delete user
      db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          db.close();
          return reject(err);
        }
        
        if (this.changes === 0) {
          db.run('ROLLBACK');
          db.close();
          return reject(new Error('User not found'));
        }
        
        db.run('COMMIT', (err) => {
          db.close();
          if (err) {
            return reject(err);
          }
          resolve(true);
        });
      });
    });
  });
}

/**
 * Get all users with vote counts
 * @returns {Promise<Array>} Array of user objects with vote counts
 */
async function getAllUsers() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    // First check if numeric_id column exists
    db.all("PRAGMA table_info(users)", (err, columns) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      const hasNumericId = columns.some(col => col.name === 'numeric_id');
      
      let sql;
      if (hasNumericId) {
        sql = `
          SELECT u.*, 
                 COUNT(v.id) as vote_count
          FROM users u
          LEFT JOIN votes v ON u.id = v.target_user_id
          GROUP BY u.id
          ORDER BY u.created_at DESC
        `;
      } else {
        sql = `
          SELECT u.id, u.name, u.gender, u.avatar_url, u.qr_code, u.created_at, u.updated_at,
                 COUNT(v.id) as vote_count
          FROM users u
          LEFT JOIN votes v ON u.id = v.target_user_id
          GROUP BY u.id
          ORDER BY u.created_at DESC
        `;
      }
      
      db.all(sql, [], (err, rows) => {
        db.close();
        
        if (err) {
          return reject(err);
        }
        
        const users = rows.map(row => ({
          id: row.id,
          numericId: hasNumericId ? row.numeric_id : null,
          name: row.name,
          gender: row.gender,
          avatarUrl: row.avatar_url,
          qrCode: row.qr_code,
          voteCount: row.vote_count || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
        
        resolve(users);
      });
    });
  });
}

/**
 * Get user by name (for duplicate name checking)
 * @param {string} name - User's name
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function getUserByName(name) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    if (!name || !name.trim()) {
      db.close();
      return reject(new Error('Name is required'));
    }
    
    // First check if numeric_id column exists
    db.all("PRAGMA table_info(users)", (err, columns) => {
      if (err) {
        db.close();
        return reject(err);
      }
      
      const hasNumericId = columns.some(col => col.name === 'numeric_id');
      
      let sql;
      if (hasNumericId) {
        sql = `
          SELECT u.*, 
                 COUNT(v.id) as vote_count
          FROM users u
          LEFT JOIN votes v ON u.id = v.target_user_id
          WHERE LOWER(u.name) = LOWER(?)
          GROUP BY u.id
        `;
      } else {
        sql = `
          SELECT u.id, u.name, u.gender, u.avatar_url, u.qr_code, u.created_at, u.updated_at,
                 COUNT(v.id) as vote_count
          FROM users u
          LEFT JOIN votes v ON u.id = v.target_user_id
          WHERE LOWER(u.name) = LOWER(?)
          GROUP BY u.id
        `;
      }
      
      db.get(sql, [name.trim()], (err, row) => {
        db.close();
        
        if (err) {
          return reject(err);
        }
        
        if (!row) {
          return resolve(null);
        }
        
        resolve({
          id: row.id,
          numericId: hasNumericId ? row.numeric_id : null,
          name: row.name,
          gender: row.gender,
          avatarUrl: row.avatar_url,
          qrCode: row.qr_code,
          voteCount: row.vote_count || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      });
    });
  });
}

// ==================== VOTING OPERATIONS ====================

/**
 * Record a vote (internal function - use atomicVote for concurrent safety)
 * @param {Object} voteData - Vote data object
 * @param {string} voteData.voterId - ID of the voter (can be null for anonymous votes)
 * @param {string} voteData.targetUserId - ID of the target user being voted for
 * @param {string} [voteData.ipAddress] - IP address of the voter
 * @returns {Promise<Object>} Created vote object
 */
async function recordVote(voteData) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const { voterId = null, targetUserId, ipAddress = null } = voteData;
    
    if (!targetUserId) {
      db.close();
      return reject(new Error('Target user ID is required'));
    }
    
    const sql = `
      INSERT INTO votes (voter_id, target_user_id, vote_time, ip_address)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    `;
    
    db.run(sql, [voterId, targetUserId, ipAddress], function(err) {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      resolve({
        id: this.lastID,
        voterId,
        targetUserId,
        voteTime: new Date().toISOString(),
        ipAddress
      });
    });
  });
}

/**
 * Atomic vote operation that handles voting and restrictions in a single transaction
 * This function ensures concurrent voting consistency by using database transactions
 * @param {Object} voteData - Vote data object
 * @param {string} voteData.voterId - ID of the voter
 * @param {string} voteData.targetUserId - ID of the target user being voted for
 * @param {string} voteData.targetGender - Gender of the target user ('male' or 'female')
 * @param {string} [voteData.ipAddress] - IP address of the voter
 * @returns {Promise<Object>} Vote result with success status and details
 */
async function atomicVote(voteData) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    const { voterId, targetUserId, targetGender, ipAddress = null } = voteData;
    
    // Validate required fields
    if (!voterId) {
      db.close();
      return reject(new Error('Voter ID is required for atomic voting'));
    }
    
    if (!targetUserId) {
      db.close();
      return reject(new Error('Target user ID is required'));
    }
    
    if (!['male', 'female'].includes(targetGender)) {
      db.close();
      return reject(new Error('Target gender must be either "male" or "female"'));
    }
    
    db.serialize(() => {
      // Start transaction
      db.run('BEGIN IMMEDIATE TRANSACTION', (err) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        // Check current vote restrictions within the transaction
        const checkSql = 'SELECT * FROM vote_restrictions WHERE voter_id = ?';
        db.get(checkSql, [voterId], (err, row) => {
          if (err) {
            db.run('ROLLBACK');
            db.close();
            return reject(err);
          }
          
          // Determine if voter can vote for this gender
          let canVote = false;
          if (!row) {
            // No restrictions exist, can vote
            canVote = true;
          } else {
            // Check gender-specific restrictions
            if (targetGender === 'male' && !row.male_voted_user_id) {
              canVote = true;
            } else if (targetGender === 'female' && !row.female_voted_user_id) {
              canVote = true;
            }
          }
          
          if (!canVote) {
            db.run('ROLLBACK');
            db.close();
            return resolve({
              success: false,
              reason: 'already_voted',
              message: `已经为${targetGender === 'male' ? '男士' : '女士'}参与者投过票了`
            });
          }
          
          // Record the vote
          const voteSql = `
            INSERT INTO votes (voter_id, target_user_id, vote_time, ip_address)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
          `;
          
          db.run(voteSql, [voterId, targetUserId, ipAddress], function(voteErr) {
            if (voteErr) {
              db.run('ROLLBACK');
              db.close();
              return reject(voteErr);
            }
            
            const voteId = this.lastID;
            
            // Update or create vote restrictions
            if (row) {
              // Update existing record
              const field = targetGender === 'male' ? 'male_voted_user_id' : 'female_voted_user_id';
              const updateSql = `
                UPDATE vote_restrictions 
                SET ${field} = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE voter_id = ?
              `;
              
              db.run(updateSql, [targetUserId, voterId], (updateErr) => {
                if (updateErr) {
                  db.run('ROLLBACK');
                  db.close();
                  return reject(updateErr);
                }
                
                // Commit transaction
                db.run('COMMIT', (commitErr) => {
                  db.close();
                  if (commitErr) {
                    return reject(commitErr);
                  }
                  
                  resolve({
                    success: true,
                    voteId,
                    voterId,
                    targetUserId,
                    targetGender,
                    voteTime: new Date().toISOString(),
                    ipAddress
                  });
                });
              });
            } else {
              // Create new record
              const maleVotedUserId = targetGender === 'male' ? targetUserId : null;
              const femaleVotedUserId = targetGender === 'female' ? targetUserId : null;
              
              const insertSql = `
                INSERT INTO vote_restrictions (voter_id, male_voted_user_id, female_voted_user_id, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `;
              
              db.run(insertSql, [voterId, maleVotedUserId, femaleVotedUserId], (insertErr) => {
                if (insertErr) {
                  db.run('ROLLBACK');
                  db.close();
                  return reject(insertErr);
                }
                
                // Commit transaction
                db.run('COMMIT', (commitErr) => {
                  db.close();
                  if (commitErr) {
                    return reject(commitErr);
                  }
                  
                  resolve({
                    success: true,
                    voteId,
                    voterId,
                    targetUserId,
                    targetGender,
                    voteTime: new Date().toISOString(),
                    ipAddress
                  });
                });
              });
            }
          });
        });
      });
    });
  });
}

/**
 * Get vote statistics
 * @returns {Promise<Object>} Vote statistics object
 */
async function getVoteStatistics() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const sql = `
      SELECT 
        COUNT(DISTINCT u.id) as total_participants,
        COUNT(v.id) as total_votes,
        COUNT(DISTINCT CASE WHEN u.gender = 'male' THEN u.id END) as male_participants,
        COUNT(DISTINCT CASE WHEN u.gender = 'female' THEN u.id END) as female_participants,
        COUNT(CASE WHEN u.gender = 'male' THEN v.id END) as male_votes,
        COUNT(CASE WHEN u.gender = 'female' THEN v.id END) as female_votes
      FROM users u
      LEFT JOIN votes v ON u.id = v.target_user_id
    `;
    
    db.get(sql, [], (err, row) => {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      resolve({
        totalParticipants: row.total_participants || 0,
        totalVotes: row.total_votes || 0,
        maleParticipants: row.male_participants || 0,
        femaleParticipants: row.female_participants || 0,
        maleVotes: row.male_votes || 0,
        femaleVotes: row.female_votes || 0
      });
    });
  });
}

/**
 * Get ranking by gender
 * @param {string} [gender] - Filter by gender ('male' or 'female'), or null for all
 * @returns {Promise<Object>} Ranking object with male and female arrays
 */
async function getRanking(gender = null) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    let sql = `
      SELECT u.id, u.name, u.gender, u.avatar_url,
             COUNT(v.id) as vote_count
      FROM users u
      LEFT JOIN votes v ON u.id = v.target_user_id
    `;
    
    const params = [];
    if (gender) {
      sql += ' WHERE u.gender = ?';
      params.push(gender);
    }
    
    sql += `
      GROUP BY u.id, u.name, u.gender, u.avatar_url
      ORDER BY u.gender, vote_count DESC, u.name ASC
    `;
    
    db.all(sql, params, (err, rows) => {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      const ranking = {
        male: [],
        female: []
      };
      
      let maleRank = 1;
      let femaleRank = 1;
      
      rows.forEach(row => {
        const user = {
          userId: row.id,
          name: row.name,
          avatarUrl: row.avatar_url,
          voteCount: row.vote_count || 0,
          rank: row.gender === 'male' ? maleRank++ : femaleRank++
        };
        
        ranking[row.gender].push(user);
      });
      
      resolve(ranking);
    });
  });
}

/**
 * Get votes for a specific user
 * @param {string} targetUserId - Target user ID
 * @returns {Promise<Array>} Array of vote objects
 */
async function getVotesForUser(targetUserId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const sql = `
      SELECT v.*, u.name as voter_name
      FROM votes v
      LEFT JOIN users u ON v.voter_id = u.id
      WHERE v.target_user_id = ?
      ORDER BY v.vote_time DESC
    `;
    
    db.all(sql, [targetUserId], (err, rows) => {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      const votes = rows.map(row => ({
        id: row.id,
        voterId: row.voter_id,
        voterName: row.voter_name,
        targetUserId: row.target_user_id,
        voteTime: row.vote_time,
        ipAddress: row.ip_address
      }));
      
      resolve(votes);
    });
  });
}

// ==================== VOTE RESTRICTION OPERATIONS ====================

/**
 * Check vote restrictions for a voter
 * @param {string} voterId - Voter ID
 * @returns {Promise<Object>} Vote restriction status
 */
async function checkVoteRestrictions(voterId) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const sql = `
      SELECT vr.*,
             male_user.name as male_voted_name,
             female_user.name as female_voted_name
      FROM vote_restrictions vr
      LEFT JOIN users male_user ON vr.male_voted_user_id = male_user.id
      LEFT JOIN users female_user ON vr.female_voted_user_id = female_user.id
      WHERE vr.voter_id = ?
    `;
    
    db.get(sql, [voterId], (err, row) => {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      if (!row) {
        // No restrictions found, voter can vote for both genders
        return resolve({
          voterId,
          maleVoted: false,
          femaleVoted: false,
          maleVotedUserId: null,
          femaleVotedUserId: null,
          maleVotedName: null,
          femaleVotedName: null,
          votedUsers: []
        });
      }
      
      const votedUsers = [];
      if (row.male_voted_user_id) {
        votedUsers.push({
          userId: row.male_voted_user_id,
          name: row.male_voted_name,
          gender: 'male'
        });
      }
      if (row.female_voted_user_id) {
        votedUsers.push({
          userId: row.female_voted_user_id,
          name: row.female_voted_name,
          gender: 'female'
        });
      }
      
      resolve({
        voterId,
        maleVoted: !!row.male_voted_user_id,
        femaleVoted: !!row.female_voted_user_id,
        maleVotedUserId: row.male_voted_user_id,
        femaleVotedUserId: row.female_voted_user_id,
        maleVotedName: row.male_voted_name,
        femaleVotedName: row.female_voted_name,
        votedUsers
      });
    });
  });
}

/**
 * Update vote restrictions after a vote
 * @param {string} voterId - Voter ID
 * @param {string} targetUserId - Target user ID that was voted for
 * @param {string} targetGender - Gender of the target user ('male' or 'female')
 * @returns {Promise<Object>} Updated vote restriction object
 */
async function updateVoteRestrictions(voterId, targetUserId, targetGender) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    if (!['male', 'female'].includes(targetGender)) {
      db.close();
      return reject(new Error('Target gender must be either "male" or "female"'));
    }
    
    db.serialize(() => {
      // Check if restriction record exists
      db.get('SELECT * FROM vote_restrictions WHERE voter_id = ?', [voterId], (err, row) => {
        if (err) {
          db.close();
          return reject(err);
        }
        
        if (row) {
          // Update existing record
          const field = targetGender === 'male' ? 'male_voted_user_id' : 'female_voted_user_id';
          const sql = `UPDATE vote_restrictions SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE voter_id = ?`;
          
          db.run(sql, [targetUserId, voterId], function(err) {
            if (err) {
              db.close();
              return reject(err);
            }
            
            // Get updated restrictions
            checkVoteRestrictions(voterId)
              .then(resolve)
              .catch(reject);
          });
        } else {
          // Create new record
          const maleVotedUserId = targetGender === 'male' ? targetUserId : null;
          const femaleVotedUserId = targetGender === 'female' ? targetUserId : null;
          
          const sql = `
            INSERT INTO vote_restrictions (voter_id, male_voted_user_id, female_voted_user_id, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `;
          
          db.run(sql, [voterId, maleVotedUserId, femaleVotedUserId], function(err) {
            if (err) {
              db.close();
              return reject(err);
            }
            
            // Get created restrictions
            checkVoteRestrictions(voterId)
              .then(resolve)
              .catch(reject);
          });
        }
      });
    });
  });
}

/**
 * Check if a voter can vote for a specific gender
 * @param {string} voterId - Voter ID
 * @param {string} targetGender - Target gender ('male' or 'female')
 * @returns {Promise<boolean>} True if voter can vote for this gender
 */
async function canVoteForGender(voterId, targetGender) {
  try {
    const restrictions = await checkVoteRestrictions(voterId);
    
    if (targetGender === 'male') {
      return !restrictions.maleVoted;
    } else if (targetGender === 'female') {
      return !restrictions.femaleVoted;
    }
    
    return false;
  } catch (error) {
    throw error;
  }
}

/**
 * Clear all vote restrictions (admin function)
 * @returns {Promise<boolean>} True if cleared successfully
 */
async function clearAllVoteRestrictions() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.run('DELETE FROM vote_restrictions', [], function(err) {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      resolve(true);
    });
  });
}

/**
 * Get recent votes with user information
 * @param {number} [limit=20] - Number of recent votes to retrieve
 * @returns {Promise<Array>} Array of recent vote objects with user info
 */
async function getRecentVotes(limit = 20) {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const sql = `
      SELECT v.*, 
             target_user.name as target_name,
             target_user.gender as target_gender,
             target_user.avatar_url as target_avatar,
             voter_user.name as voter_name
      FROM votes v
      LEFT JOIN users target_user ON v.target_user_id = target_user.id
      LEFT JOIN users voter_user ON v.voter_id = voter_user.id
      ORDER BY v.vote_time DESC
      LIMIT ?
    `;
    
    db.all(sql, [limit], (err, rows) => {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      const votes = rows.map(row => ({
        id: row.id,
        voterId: row.voter_id,
        voterName: row.voter_name,
        targetUserId: row.target_user_id,
        targetName: row.target_name,
        targetGender: row.target_gender,
        targetAvatar: row.target_avatar,
        voteTime: row.vote_time,
        ipAddress: row.ip_address
      }));
      
      resolve(votes);
    });
  });
}

/**
 * Get voting progress statistics
 * @returns {Promise<Object>} Voting progress statistics
 */
async function getVotingProgress() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    const sql = `
      SELECT 
        COUNT(DISTINCT vr.voter_id) as active_voters,
        COUNT(CASE WHEN vr.male_voted_user_id IS NOT NULL THEN 1 END) as male_votes_cast,
        COUNT(CASE WHEN vr.female_voted_user_id IS NOT NULL THEN 1 END) as female_votes_cast,
        COUNT(CASE WHEN vr.male_voted_user_id IS NOT NULL AND vr.female_voted_user_id IS NOT NULL THEN 1 END) as completed_voters
      FROM vote_restrictions vr
    `;
    
    db.get(sql, [], (err, row) => {
      db.close();
      
      if (err) {
        return reject(err);
      }
      
      resolve({
        activeVoters: row.active_voters || 0,
        maleVotesCast: row.male_votes_cast || 0,
        femaleVotesCast: row.female_votes_cast || 0,
        completedVoters: row.completed_voters || 0,
        votingCompletionRate: row.active_voters > 0 ? 
          ((row.completed_voters || 0) / row.active_voters * 100).toFixed(2) : '0.00'
      });
    });
  });
}
async function clearAllData() {
  return new Promise((resolve, reject) => {
    const db = getDatabase();
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      db.run('DELETE FROM vote_restrictions', [], (err) => {
        if (err) {
          db.run('ROLLBACK');
          db.close();
          return reject(err);
        }
      });
      
      db.run('DELETE FROM votes', [], (err) => {
        if (err) {
          db.run('ROLLBACK');
          db.close();
          return reject(err);
        }
      });
      
      db.run('DELETE FROM users', [], function(err) {
        if (err) {
          db.run('ROLLBACK');
          db.close();
          return reject(err);
        }
        
        db.run('COMMIT', (err) => {
          db.close();
          if (err) {
            return reject(err);
          }
          resolve(true);
        });
      });
    });
  });
}

module.exports = {
  // User operations
  createUser,
  getUserById,
  getUserByName,
  getUserByNumericId,
  updateUser,
  deleteUser,
  getAllUsers,
  
  // Voting operations
  recordVote,
  atomicVote,
  getVoteStatistics,
  getRanking,
  getVotesForUser,
  getRecentVotes,
  getVotingProgress,
  
  // Vote restriction operations
  checkVoteRestrictions,
  updateVoteRestrictions,
  canVoteForGender,
  clearAllVoteRestrictions,
  clearAllData
};