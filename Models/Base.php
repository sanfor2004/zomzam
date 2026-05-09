<?php
/**
 * Base Model
 * 
 * This model is the base class for all models in the application.
 * It provides common functionality for all models.
 */
class Base
{
    protected $db;
    protected $pdo;
    protected $table; // Child models should define this

    public function __construct()
    {
        $this->db = getConnectionI();
        $this->pdo = getConnection();
    }

    public function getTables()
    {
        $result = $this->db->query("SHOW TABLES");
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function ping()
    {
        try {
            if ($this->db && $this->db->ping()) {
                return true;
            }
        } catch (\Exception $e) {
            return false;
        }
        return false;
    }

    /**
     * Reconnect to database if connection is lost
     */
    public function reconnect()
    {
        try {
            // Close existing connections
            if ($this->db) {
                @$this->db->close();
            }
            
            // Recreate connections
            $this->db = getConnectionI();
            $this->pdo = getConnection();
            
            return true;
        } catch (\Exception $e) {
            error_log("Database reconnection failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Ensure database connection is alive, reconnect if needed
     */
    public function ensureConnection()
    {
        if (!$this->ping()) {
            return $this->reconnect();
        }
        return true;
    }

    public function query($query)
    {
        $result = $this->db->query($query);
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function queryOne($query)
    {
        $result = $this->db->query($query);
        if (!$result) {
            echo $this->db->error;
            return null; // Suppress fatal DB exceptions cleanly
        }
        return $result->fetch_assoc();
    }

    public function execute($query)
    {
        $result = $this->db->query($query);
        return $result;
    }

    public function lastInsertId()
    {
        return $this->db->insert_id;
    }

    public function lastError()
    {
        return $this->db->error;
    }

    public function refresh()
    {
        return $this->db->refresh(MYSQLI_REFRESH_LOG);
    }

    public function autoCommit($enable = true)
    {
        return $this->db->autocommit($enable);
    }

    public function commit()
    {
        return $this->db->commit();
    }

    public function rollback()
    {
        return $this->db->rollback();
    }

    public function escape($value)
    {
        return $this->db->real_escape_string($value);
    }

    public function close()
    {
        $this->db->close();
    }

    public function getAll()
    {
        $result = $this->db->query("SELECT * FROM `{$this->table}`");
        return $result->fetch_all(MYSQLI_ASSOC);
    }

    public function getById($id)
    {
        $result = $this->db->query("SELECT * FROM `{$this->table}` WHERE id = $id");
        return $result->fetch_assoc();
    }

    public function getByColumn($column, $value)
    {
        $result = $this->db->query("SELECT * FROM `{$this->table}` WHERE `$column` = '$value'");
        return $result->fetch_assoc();
    }

    /**
     * ========================================
     * SECURITY HELPERS
     * ========================================
     */

    /**
     * Sanitize input to prevent XSS
     * Wrapper for Security::sanitizeInput()
     * 
     * @param mixed $input Input to sanitize
     * @param bool $allowHtml Allow safe HTML tags
     * @return mixed Sanitized input
     */
    protected function sanitize($input, $allowHtml = false)
    {
        if (!class_exists('Security')) {
            require_once __DIR__ . '/Security.php';
        }
        return Security::sanitizeInput($input, $allowHtml);
    }

    /**
     * Validate email address
     * 
     * @param string $email Email to validate
     * @return bool Valid or not
     */
    protected function validateEmail($email)
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Validate integer with optional min/max
     * 
     * @param mixed $value Value to validate
     * @param int $min Minimum value
     * @param int $max Maximum value
     * @return int|false Valid integer or false
     */
    protected function validateInt($value, $min = null, $max = null)
    {
        $int = filter_var($value, FILTER_VALIDATE_INT);
        
        if ($int === false) {
            return false;
        }

        if ($min !== null && $int < $min) {
            return false;
        }

        if ($max !== null && $int > $max) {
            return false;
        }

        return $int;
    }

    /**
     * Get client IP address (proxy-aware)
     * 
     * @return string Client IP
     */
    protected function getClientIp()
    {
        if (!class_exists('Security')) {
            require_once __DIR__ . '/Security.php';
        }
        return Security::getClientIp();
    }

    /**
     * Log error or event to file
     * 
     * @param string $message Message to log
     * @param string $level Log level (info, warning, error, critical)
     */
    protected function log($message, $level = 'info')
    {
        $timestamp = date('Y-m-d H:i:s');
        $logMessage = "[{$timestamp}] [{$level}] {$message}\n";
        
        $logFile = __DIR__ . '/../logs/app.log';
        @mkdir(dirname($logFile), 0755, true);
        error_log($logMessage, 3, $logFile);
    }

    /**
     * Search records by column value with LIKE - SECURE VERSION
     * 
     * @param string $column Column name to search
     * @param string $value Search value
     * @return array Search results
     */
    public function search($column, $value)
    {
        if (!$this->table) {
            return [];
        }

        // Use PDO prepared statement for security
        $stmt = $this->pdo->prepare("
            SELECT * FROM `{$this->table}` 
            WHERE `{$column}` LIKE ?
        ");
        $stmt->execute(['%' . $value . '%']);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>