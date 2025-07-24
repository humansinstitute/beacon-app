/**
 * Session Backup and Restore Utilities
 * Provides comprehensive backup and restore capabilities for WhatsApp Web.js session data
 */

import fs from "fs";
import path from "path";
import { logDiagnostic } from "./sessionDiagnostics.js";

/**
 * Session backup manager for creating and managing session data backups
 */
export class SessionBackupManager {
  constructor(options = {}) {
    this.backupBaseDir =
      options.backupBaseDir || path.join(process.cwd(), ".wwebjs_backups");
    this.maxBackups = options.maxBackups || 10;
    this.compressionEnabled = options.compressionEnabled || false;
  }

  /**
   * Create a timestamped backup of session data
   * @param {string} sessionPath - Path to the session directory to backup
   * @param {Object} options - Backup options
   * @returns {Promise<Object>} Backup result with path and metadata
   */
  async createBackup(sessionPath, options = {}) {
    const startTime = Date.now();
    const {
      reason = "manual",
      includeMetadata = true,
      preserveStructure = true,
    } = options;

    const result = {
      success: false,
      backupPath: null,
      metadata: null,
      duration: 0,
      error: null,
      stats: {
        filesBackedUp: 0,
        totalSize: 0,
        skippedFiles: 0,
      },
    };

    try {
      // Ensure backup directory exists
      await this._ensureBackupDirectory();

      // Generate backup path with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const sessionName = path.basename(sessionPath);
      const backupName = `${sessionName}_${timestamp}_${reason}`;
      const backupPath = path.join(this.backupBaseDir, backupName);

      result.backupPath = backupPath;

      // Check if source session exists
      if (!fs.existsSync(sessionPath)) {
        throw new Error(`Session directory does not exist: ${sessionPath}`);
      }

      logDiagnostic("info", "Starting session backup", {
        sessionPath,
        backupPath,
        reason,
        timestamp,
      });

      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });

      // Copy session data with structure preservation
      if (preserveStructure) {
        await this._copyDirectoryRecursive(
          sessionPath,
          backupPath,
          result.stats
        );
      } else {
        await this._copyDirectoryFlat(sessionPath, backupPath, result.stats);
      }

      // Create metadata file if requested
      if (includeMetadata) {
        const metadata = await this._createBackupMetadata(
          sessionPath,
          backupPath,
          reason
        );
        result.metadata = metadata;

        const metadataPath = path.join(backupPath, "backup_metadata.json");
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      }

      // Cleanup old backups if needed
      await this._cleanupOldBackups();

      result.success = true;
      result.duration = Date.now() - startTime;

      logDiagnostic("info", "Session backup completed successfully", {
        backupPath,
        duration: result.duration,
        filesBackedUp: result.stats.filesBackedUp,
        totalSize: result.stats.totalSize,
      });
    } catch (error) {
      result.error = error.message;
      result.duration = Date.now() - startTime;

      logDiagnostic("error", "Session backup failed", {
        sessionPath,
        backupPath: result.backupPath,
        error: error.message,
        duration: result.duration,
      });

      // Cleanup failed backup directory
      if (result.backupPath && fs.existsSync(result.backupPath)) {
        try {
          fs.rmSync(result.backupPath, { recursive: true, force: true });
        } catch (cleanupError) {
          logDiagnostic("warn", "Failed to cleanup failed backup", {
            backupPath: result.backupPath,
            error: cleanupError.message,
          });
        }
      }
    }

    return result;
  }

  /**
   * Restore session data from a backup
   * @param {string} backupPath - Path to the backup directory
   * @param {string} targetSessionPath - Target path for restoration
   * @param {Object} options - Restore options
   * @returns {Promise<Object>} Restore result
   */
  async restoreFromBackup(backupPath, targetSessionPath, options = {}) {
    const startTime = Date.now();
    const {
      overwriteExisting = false,
      validateBeforeRestore = true,
      createTargetBackup = true,
    } = options;

    const result = {
      success: false,
      restoredPath: targetSessionPath,
      targetBackupPath: null,
      duration: 0,
      error: null,
      stats: {
        filesRestored: 0,
        totalSize: 0,
        skippedFiles: 0,
      },
    };

    try {
      // Validate backup exists
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup directory does not exist: ${backupPath}`);
      }

      // Validate backup integrity if requested
      if (validateBeforeRestore) {
        const validation = await this._validateBackup(backupPath);
        if (!validation.isValid) {
          throw new Error(
            `Backup validation failed: ${validation.errors.join(", ")}`
          );
        }
      }

      logDiagnostic("info", "Starting session restore", {
        backupPath,
        targetSessionPath,
        overwriteExisting,
      });

      // Create backup of existing target if it exists and requested
      if (fs.existsSync(targetSessionPath) && createTargetBackup) {
        const targetBackup = await this.createBackup(targetSessionPath, {
          reason: "pre_restore",
          includeMetadata: true,
        });

        if (targetBackup.success) {
          result.targetBackupPath = targetBackup.backupPath;
          logDiagnostic("info", "Created backup of existing target session", {
            targetBackupPath: result.targetBackupPath,
          });
        }
      }

      // Remove existing target if overwrite is enabled
      if (fs.existsSync(targetSessionPath)) {
        if (overwriteExisting) {
          fs.rmSync(targetSessionPath, { recursive: true, force: true });
        } else {
          throw new Error(
            `Target session path already exists: ${targetSessionPath}`
          );
        }
      }

      // Create target directory
      fs.mkdirSync(targetSessionPath, { recursive: true });

      // Copy backup data to target
      await this._copyDirectoryRecursive(
        backupPath,
        targetSessionPath,
        result.stats,
        {
          excludeFiles: ["backup_metadata.json"],
        }
      );

      result.success = true;
      result.duration = Date.now() - startTime;

      logDiagnostic("info", "Session restore completed successfully", {
        backupPath,
        targetSessionPath,
        duration: result.duration,
        filesRestored: result.stats.filesRestored,
        totalSize: result.stats.totalSize,
      });
    } catch (error) {
      result.error = error.message;
      result.duration = Date.now() - startTime;

      logDiagnostic("error", "Session restore failed", {
        backupPath,
        targetSessionPath,
        error: error.message,
        duration: result.duration,
      });

      // Cleanup failed restore if target was created
      if (fs.existsSync(targetSessionPath)) {
        try {
          fs.rmSync(targetSessionPath, { recursive: true, force: true });
        } catch (cleanupError) {
          logDiagnostic("warn", "Failed to cleanup failed restore", {
            targetSessionPath,
            error: cleanupError.message,
          });
        }
      }
    }

    return result;
  }

  /**
   * List available backups
   * @param {Object} options - Listing options
   * @returns {Promise<Array>} Array of backup information
   */
  async listBackups(options = {}) {
    const { includeMetadata = false, sortBy = "timestamp" } = options;
    const backups = [];

    try {
      if (!fs.existsSync(this.backupBaseDir)) {
        return backups;
      }

      const entries = fs.readdirSync(this.backupBaseDir);

      for (const entry of entries) {
        const backupPath = path.join(this.backupBaseDir, entry);
        const stats = fs.statSync(backupPath);

        if (stats.isDirectory()) {
          const backup = {
            name: entry,
            path: backupPath,
            created: stats.birthtime,
            modified: stats.mtime,
            size: await this._calculateDirectorySize(backupPath),
          };

          // Parse backup name for additional info
          const nameParts = entry.split("_");
          if (nameParts.length >= 3) {
            backup.sessionName = nameParts[0];
            backup.reason = nameParts[nameParts.length - 1];
          }

          // Include metadata if requested
          if (includeMetadata) {
            const metadataPath = path.join(backupPath, "backup_metadata.json");
            if (fs.existsSync(metadataPath)) {
              try {
                backup.metadata = JSON.parse(
                  fs.readFileSync(metadataPath, "utf8")
                );
              } catch (error) {
                backup.metadataError = error.message;
              }
            }
          }

          backups.push(backup);
        }
      }

      // Sort backups
      if (sortBy === "timestamp") {
        backups.sort((a, b) => b.created.getTime() - a.created.getTime());
      } else if (sortBy === "size") {
        backups.sort((a, b) => b.size - a.size);
      }
    } catch (error) {
      logDiagnostic("error", "Failed to list backups", {
        backupBaseDir: this.backupBaseDir,
        error: error.message,
      });
    }

    return backups;
  }

  /**
   * Delete a specific backup
   * @param {string} backupPath - Path to the backup to delete
   * @returns {Promise<boolean>} True if deletion was successful
   */
  async deleteBackup(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        logDiagnostic("warn", "Backup does not exist for deletion", {
          backupPath,
        });
        return true;
      }

      fs.rmSync(backupPath, { recursive: true, force: true });

      logDiagnostic("info", "Backup deleted successfully", { backupPath });
      return true;
    } catch (error) {
      logDiagnostic("error", "Failed to delete backup", {
        backupPath,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Ensure backup directory exists
   * @private
   */
  async _ensureBackupDirectory() {
    if (!fs.existsSync(this.backupBaseDir)) {
      fs.mkdirSync(this.backupBaseDir, { recursive: true });
      logDiagnostic("info", "Created backup directory", {
        backupBaseDir: this.backupBaseDir,
      });
    }
  }

  /**
   * Copy directory recursively with statistics tracking
   * @private
   */
  async _copyDirectoryRecursive(source, target, stats, options = {}) {
    const { excludeFiles = [] } = options;

    const entries = fs.readdirSync(source);

    for (const entry of entries) {
      if (excludeFiles.includes(entry)) {
        stats.skippedFiles++;
        continue;
      }

      const sourcePath = path.join(source, entry);
      const targetPath = path.join(target, entry);
      const sourceStats = fs.statSync(sourcePath);

      if (sourceStats.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        await this._copyDirectoryRecursive(
          sourcePath,
          targetPath,
          stats,
          options
        );
      } else {
        try {
          fs.copyFileSync(sourcePath, targetPath);
          stats.filesBackedUp++;
          stats.totalSize += sourceStats.size;
        } catch (error) {
          logDiagnostic("warn", "Failed to copy file during backup", {
            sourcePath,
            targetPath,
            error: error.message,
          });
          stats.skippedFiles++;
        }
      }
    }
  }

  /**
   * Copy directory with flat structure
   * @private
   */
  async _copyDirectoryFlat(source, target, stats) {
    const files = this._getAllFiles(source);

    for (const file of files) {
      const relativePath = path.relative(source, file);
      const flatName = relativePath.replace(/[/\\]/g, "_");
      const targetPath = path.join(target, flatName);

      try {
        fs.copyFileSync(file, targetPath);
        const fileStats = fs.statSync(file);
        stats.filesBackedUp++;
        stats.totalSize += fileStats.size;
      } catch (error) {
        logDiagnostic("warn", "Failed to copy file during flat backup", {
          sourcePath: file,
          targetPath,
          error: error.message,
        });
        stats.skippedFiles++;
      }
    }
  }

  /**
   * Get all files in directory recursively
   * @private
   */
  _getAllFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        files.push(...this._getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Create backup metadata
   * @private
   */
  async _createBackupMetadata(sessionPath, backupPath, reason) {
    const metadata = {
      version: "1.0",
      created: new Date().toISOString(),
      reason,
      source: {
        path: sessionPath,
        name: path.basename(sessionPath),
      },
      backup: {
        path: backupPath,
        name: path.basename(backupPath),
      },
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        processId: process.pid,
      },
      integrity: {
        fileCount: 0,
        totalSize: 0,
        checksums: {},
      },
    };

    // Calculate file count and size
    if (fs.existsSync(sessionPath)) {
      metadata.integrity.totalSize = await this._calculateDirectorySize(
        sessionPath
      );
      metadata.integrity.fileCount = this._countFiles(sessionPath);
    }

    return metadata;
  }

  /**
   * Validate backup integrity
   * @private
   */
  async _validateBackup(backupPath) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Check if backup directory exists
      if (!fs.existsSync(backupPath)) {
        validation.isValid = false;
        validation.errors.push("Backup directory does not exist");
        return validation;
      }

      // Check for metadata file
      const metadataPath = path.join(backupPath, "backup_metadata.json");
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

          // Validate metadata structure
          if (!metadata.version || !metadata.created) {
            validation.warnings.push("Backup metadata is incomplete");
          }

          // Validate file count if available
          if (metadata.integrity?.fileCount) {
            const actualFileCount = this._countFiles(backupPath) - 1; // Exclude metadata file
            if (actualFileCount !== metadata.integrity.fileCount) {
              validation.warnings.push(
                `File count mismatch: expected ${metadata.integrity.fileCount}, found ${actualFileCount}`
              );
            }
          }
        } catch (error) {
          validation.warnings.push(
            `Failed to parse backup metadata: ${error.message}`
          );
        }
      } else {
        validation.warnings.push("No backup metadata found");
      }

      // Check for essential session files
      const essentialPaths = [
        "Default",
        "Default/Local Storage",
        "Default/Session Storage",
      ];

      for (const essentialPath of essentialPaths) {
        const fullPath = path.join(backupPath, essentialPath);
        if (!fs.existsSync(fullPath)) {
          validation.warnings.push(`Missing essential path: ${essentialPath}`);
        }
      }
    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Backup validation failed: ${error.message}`);
    }

    return validation;
  }

  /**
   * Calculate directory size recursively
   * @private
   */
  async _calculateDirectorySize(dirPath) {
    let totalSize = 0;

    try {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          totalSize += await this._calculateDirectorySize(fullPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible files/directories
    }

    return totalSize;
  }

  /**
   * Count files in directory recursively
   * @private
   */
  _countFiles(dirPath) {
    let fileCount = 0;

    try {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          fileCount += this._countFiles(fullPath);
        } else {
          fileCount++;
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible files/directories
    }

    return fileCount;
  }

  /**
   * Cleanup old backups based on maxBackups setting
   * @private
   */
  async _cleanupOldBackups() {
    try {
      const backups = await this.listBackups({ sortBy: "timestamp" });

      if (backups.length > this.maxBackups) {
        const backupsToDelete = backups.slice(this.maxBackups);

        logDiagnostic("info", "Cleaning up old backups", {
          totalBackups: backups.length,
          maxBackups: this.maxBackups,
          backupsToDelete: backupsToDelete.length,
        });

        for (const backup of backupsToDelete) {
          await this.deleteBackup(backup.path);
        }
      }
    } catch (error) {
      logDiagnostic("warn", "Failed to cleanup old backups", {
        error: error.message,
      });
    }
  }
}

/**
 * Create a quick backup of session data
 * @param {string} sessionPath - Path to session directory
 * @param {string} reason - Reason for backup
 * @returns {Promise<Object>} Backup result
 */
export async function createQuickBackup(sessionPath, reason = "quick") {
  const backupManager = new SessionBackupManager();
  return await backupManager.createBackup(sessionPath, { reason });
}

/**
 * Restore session from the most recent backup
 * @param {string} sessionName - Name of the session to restore
 * @param {string} targetPath - Target path for restoration
 * @returns {Promise<Object>} Restore result
 */
export async function restoreLatestBackup(sessionName, targetPath) {
  const backupManager = new SessionBackupManager();
  const backups = await backupManager.listBackups();

  const sessionBackups = backups.filter(
    (backup) =>
      backup.sessionName === sessionName || backup.name.startsWith(sessionName)
  );

  if (sessionBackups.length === 0) {
    throw new Error(`No backups found for session: ${sessionName}`);
  }

  const latestBackup = sessionBackups[0]; // Already sorted by timestamp
  return await backupManager.restoreFromBackup(latestBackup.path, targetPath);
}
