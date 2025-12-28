USE ritual;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(1024) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_nickname (nickname)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `groups` (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  creator_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_groups_creator (creator_user_id),
  CONSTRAINT fk_groups_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS group_members (
  group_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  KEY idx_group_members_user (user_id),
  CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS things (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  author_user_id BIGINT UNSIGNED NOT NULL,
  text MEDIUMTEXT NOT NULL,
  type ENUM('anecdote','important','difficult') NOT NULL,
  emotional_weight ENUM('normal','important','difficult') NOT NULL DEFAULT 'normal',
  status ENUM('pending','told') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  told_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_things_group_status (group_id, status),
  KEY idx_things_author_status (author_user_id, status),
  CONSTRAINT fk_things_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_things_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ritual_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  status ENUM('voting','active','paused','completed') NOT NULL DEFAULT 'voting',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME NULL,
  paused_at DATETIME NULL,
  completed_at DATETIME NULL,
  current_position INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_ritual_sessions_group_status (group_id, status),
  CONSTRAINT fk_ritual_sessions_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ritual_votes (
  ritual_session_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  vote ENUM('yes','no') NOT NULL,
  voted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ritual_session_id, user_id),
  KEY idx_ritual_votes_vote (ritual_session_id, vote),
  CONSTRAINT fk_ritual_votes_session FOREIGN KEY (ritual_session_id) REFERENCES ritual_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ritual_votes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS ritual_session_items (
  ritual_session_id BIGINT UNSIGNED NOT NULL,
  position INT NOT NULL,
  thing_id BIGINT UNSIGNED NOT NULL,
  told_at DATETIME NULL,
  PRIMARY KEY (ritual_session_id, position),
  UNIQUE KEY uq_ritual_session_items_thing (ritual_session_id, thing_id),
  KEY idx_ritual_session_items_thing (thing_id),
  CONSTRAINT fk_ritual_session_items_session FOREIGN KEY (ritual_session_id) REFERENCES ritual_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_ritual_session_items_thing FOREIGN KEY (thing_id) REFERENCES things(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Comentario en espaÃ±ol: Invitaciones por email (si el usuario aÃºn no existe).
CREATE TABLE IF NOT EXISTS group_invites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id BIGINT UNSIGNED NOT NULL,
  invited_email VARCHAR(255) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  status ENUM('pending','accepted','canceled') NOT NULL DEFAULT 'pending',
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME NULL,
  accepted_by_user_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_group_invites_token_hash (token_hash),
  KEY idx_group_invites_group_status (group_id, status),
  KEY idx_group_invites_email (invited_email),
  CONSTRAINT fk_group_invites_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_invites_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_group_invites_acceptor FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

