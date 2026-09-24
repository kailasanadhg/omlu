/// OMLU Data Models
///
/// Dart equivalents of the backend API schemas.
/// All models are immutable and support JSON serialization.
library;

class User {
  final String id;
  final String email;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String? bio;
  final String createdAt;

  const User({
    required this.id,
    required this.email,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.bio,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) => User(
        id: json['id'] as String,
        email: json['email'] as String,
        username: json['username'] as String,
        displayName: json['display_name'] as String,
        avatarUrl: json['avatar_url'] as String?,
        bio: json['bio'] as String?,
        createdAt: json['created_at'] as String,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'username': username,
        'display_name': displayName,
        'avatar_url': avatarUrl,
        'bio': bio,
        'created_at': createdAt,
      };

  User copyWith({
    String? displayName,
    String? username,
    String? avatarUrl,
    String? bio,
  }) =>
      User(
        id: id,
        email: email,
        username: username ?? this.username,
        displayName: displayName ?? this.displayName,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        bio: bio ?? this.bio,
        createdAt: createdAt,
      );
}

class UserProfile {
  final String id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String? bio;
  final int memoriesCount;
  final int spacesCount;
  final bool isSelf;

  const UserProfile({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.bio,
    required this.memoriesCount,
    required this.spacesCount,
    required this.isSelf,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) => UserProfile(
        id: json['id'] as String,
        username: json['username'] as String,
        displayName: json['display_name'] as String,
        avatarUrl: json['avatar_url'] as String?,
        bio: json['bio'] as String?,
        memoriesCount: json['memories_count'] as int,
        spacesCount: json['spaces_count'] as int,
        isSelf: json['is_self'] as bool,
      );
}

class Space {
  final String id;
  final String name;
  final String? description;
  final String? coverUrl;
  final String ownerId;
  final String inviteCode;
  final int membersCount;
  final int memoriesCount;
  final bool isOwner;
  final bool isMember;
  final String createdAt;

  const Space({
    required this.id,
    required this.name,
    this.description,
    this.coverUrl,
    required this.ownerId,
    required this.inviteCode,
    required this.membersCount,
    required this.memoriesCount,
    required this.isOwner,
    required this.isMember,
    required this.createdAt,
  });

  factory Space.fromJson(Map<String, dynamic> json) => Space(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        coverUrl: json['cover_url'] as String?,
        ownerId: json['owner_id'] as String,
        inviteCode: json['invite_code'] as String,
        membersCount: json['members_count'] as int,
        memoriesCount: json['memories_count'] as int,
        isOwner: json['is_owner'] as bool,
        isMember: json['is_member'] as bool,
        createdAt: json['created_at'] as String,
      );
}

class SpaceMember {
  final String id;
  final String userId;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String role;
  final String joinedAt;

  const SpaceMember({
    required this.id,
    required this.userId,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    required this.role,
    required this.joinedAt,
  });

  factory SpaceMember.fromJson(Map<String, dynamic> json) => SpaceMember(
        id: json['id'] as String,
        userId: json['user_id'] as String,
        username: json['username'] as String,
        displayName: json['display_name'] as String,
        avatarUrl: json['avatar_url'] as String?,
        role: json['role'] as String,
        joinedAt: json['joined_at'] as String,
      );

  bool get isOwner => role == 'owner';
}

class InvitePreview {
  final String id;
  final String name;
  final String? description;
  final String? coverUrl;
  final int membersCount;
  final int memoriesCount;
  final String inviteCode;
  final bool isMember;

  const InvitePreview({
    required this.id,
    required this.name,
    this.description,
    this.coverUrl,
    required this.membersCount,
    required this.memoriesCount,
    required this.inviteCode,
    required this.isMember,
  });

  factory InvitePreview.fromJson(Map<String, dynamic> json) => InvitePreview(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        coverUrl: json['cover_url'] as String?,
        membersCount: json['members_count'] as int,
        memoriesCount: json['memories_count'] as int,
        inviteCode: json['invite_code'] as String,
        isMember: json['is_member'] as bool,
      );
}

class MediaItem {
  final String? id;
  final String cloudinaryPublicId;
  final String? cloudinaryAssetId;
  final String secureUrl;
  final String? resourceType;
  final String? format;
  final int? width;
  final int? height;
  final int? bytes;
  final int position;

  const MediaItem({
    this.id,
    required this.cloudinaryPublicId,
    this.cloudinaryAssetId,
    required this.secureUrl,
    this.resourceType,
    this.format,
    this.width,
    this.height,
    this.bytes,
    required this.position,
  });

  factory MediaItem.fromJson(Map<String, dynamic> json) => MediaItem(
        id: json['id'] as String?,
        cloudinaryPublicId: json['cloudinary_public_id'] as String,
        cloudinaryAssetId: json['cloudinary_asset_id'] as String?,
        secureUrl: json['secure_url'] as String,
        resourceType: json['resource_type'] as String?,
        format: json['format'] as String?,
        width: json['width'] as int?,
        height: json['height'] as int?,
        bytes: json['bytes'] as int?,
        position: json['position'] as int,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'cloudinary_public_id': cloudinaryPublicId,
        'cloudinary_asset_id': cloudinaryAssetId,
        'secure_url': secureUrl,
        'resource_type': resourceType,
        'format': format,
        'width': width,
        'height': height,
        'bytes': bytes,
        'position': position,
      };

  double get aspectRatio {
    if (width != null && height != null && height! > 0) {
      return width! / height!;
    }
    return 1.0;
  }
}

class Memory {
  final String id;
  final String? clientId;
  final String spaceId;
  final String spaceName;
  final String authorId;
  final String authorUsername;
  final String authorDisplayName;
  final String? authorAvatarUrl;
  final String? caption;
  final String memoryDate;
  final String createdAt;
  final List<MediaItem> mediaItems;
  final int likesCount;
  final bool isLikedByMe;
  final int commentsCount;
  final List<Note> notes;
  final bool canDelete;

  // Optimistic UI fields
  final bool isOptimistic;
  final String? uploadStatus;
  final double? uploadProgress;
  final String? errorMessage;

  const Memory({
    required this.id,
    this.clientId,
    required this.spaceId,
    required this.spaceName,
    required this.authorId,
    required this.authorUsername,
    required this.authorDisplayName,
    this.authorAvatarUrl,
    this.caption,
    required this.memoryDate,
    required this.createdAt,
    required this.mediaItems,
    required this.likesCount,
    required this.isLikedByMe,
    required this.commentsCount,
    required this.notes,
    required this.canDelete,
    this.isOptimistic = false,
    this.uploadStatus,
    this.uploadProgress,
    this.errorMessage,
  });

  factory Memory.fromJson(Map<String, dynamic> json) => Memory(
        id: json['id'] as String,
        clientId: json['client_id'] as String?,
        spaceId: json['space_id'] as String,
        spaceName: json['space_name'] as String,
        authorId: json['author_id'] as String,
        authorUsername: json['author_username'] as String,
        authorDisplayName: json['author_display_name'] as String,
        authorAvatarUrl: json['author_avatar_url'] as String?,
        caption: json['caption'] as String?,
        memoryDate: json['memory_date'] as String,
        createdAt: json['created_at'] as String,
        mediaItems: (json['media_items'] as List<dynamic>)
            .map((e) => MediaItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        likesCount: json['likes_count'] as int,
        isLikedByMe: json['is_liked_by_me'] as bool,
        commentsCount: json['comments_count'] as int,
        notes: (json['notes'] as List<dynamic>?)
                ?.map((e) => Note.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        canDelete: json['can_delete'] as bool,
      );

  Memory copyWith({
    int? likesCount,
    bool? isLikedByMe,
    int? commentsCount,
  }) =>
      Memory(
        id: id,
        clientId: clientId,
        spaceId: spaceId,
        spaceName: spaceName,
        authorId: authorId,
        authorUsername: authorUsername,
        authorDisplayName: authorDisplayName,
        authorAvatarUrl: authorAvatarUrl,
        caption: caption,
        memoryDate: memoryDate,
        createdAt: createdAt,
        mediaItems: mediaItems,
        likesCount: likesCount ?? this.likesCount,
        isLikedByMe: isLikedByMe ?? this.isLikedByMe,
        commentsCount: commentsCount ?? this.commentsCount,
        notes: notes,
        canDelete: canDelete,
        isOptimistic: isOptimistic,
        uploadStatus: uploadStatus,
        uploadProgress: uploadProgress,
        errorMessage: errorMessage,
      );
}

class Note {
  final String id;
  final String memoryId;
  final String authorId;
  final String authorUsername;
  final String authorDisplayName;
  final String? authorAvatarUrl;
  final String body;
  final String createdAt;
  final bool canDelete;

  const Note({
    required this.id,
    required this.memoryId,
    required this.authorId,
    required this.authorUsername,
    required this.authorDisplayName,
    this.authorAvatarUrl,
    required this.body,
    required this.createdAt,
    required this.canDelete,
  });

  factory Note.fromJson(Map<String, dynamic> json) => Note(
        id: json['id'] as String,
        memoryId: json['memory_id'] as String,
        authorId: json['author_id'] as String,
        authorUsername: json['author_username'] as String,
        authorDisplayName: json['author_display_name'] as String,
        authorAvatarUrl: json['author_avatar_url'] as String?,
        body: json['body'] as String,
        createdAt: json['created_at'] as String,
        canDelete: json['can_delete'] as bool,
      );
}

class Comment {
  final String id;
  final String memoryId;
  final String userId;
  final String authorUsername;
  final String authorDisplayName;
  final String? authorAvatarUrl;
  final String body;
  final String createdAt;
  final bool canDelete;

  const Comment({
    required this.id,
    required this.memoryId,
    required this.userId,
    required this.authorUsername,
    required this.authorDisplayName,
    this.authorAvatarUrl,
    required this.body,
    required this.createdAt,
    required this.canDelete,
  });

  factory Comment.fromJson(Map<String, dynamic> json) => Comment(
        id: json['id'] as String,
        memoryId: json['memory_id'] as String,
        userId: json['user_id'] as String,
        authorUsername: json['author_username'] as String,
        authorDisplayName: json['author_display_name'] as String,
        authorAvatarUrl: json['author_avatar_url'] as String?,
        body: json['body'] as String,
        createdAt: json['created_at'] as String,
        canDelete: json['can_delete'] as bool,
      );
}

class ActivityItem {
  final String id;
  final String type; // like, comment, joined_space, note
  final String actorId;
  final String actorUsername;
  final String actorDisplayName;
  final String? actorAvatarUrl;
  final String? memoryId;
  final String? spaceId;
  final String? content;
  final bool isRead;
  final String createdAt;

  const ActivityItem({
    required this.id,
    required this.type,
    required this.actorId,
    required this.actorUsername,
    required this.actorDisplayName,
    this.actorAvatarUrl,
    this.memoryId,
    this.spaceId,
    this.content,
    required this.isRead,
    required this.createdAt,
  });

  factory ActivityItem.fromJson(Map<String, dynamic> json) => ActivityItem(
        id: json['id'] as String,
        type: json['type'] as String,
        actorId: json['actor_id'] as String,
        actorUsername: json['actor_username'] as String,
        actorDisplayName: json['actor_display_name'] as String,
        actorAvatarUrl: json['actor_avatar_url'] as String?,
        memoryId: json['memory_id'] as String?,
        spaceId: json['space_id'] as String?,
        content: json['content'] as String?,
        isRead: json['is_read'] as bool,
        createdAt: json['created_at'] as String,
      );
}

class CloudinarySignature {
  final String? uploadSessionId;
  final bool? overwrite;
  final String signature;
  final int timestamp;
  final String apiKey;
  final String cloudName;
  final String folder;
  final String publicId;
  final String uploadUrl;

  const CloudinarySignature({
    this.uploadSessionId,
    this.overwrite,
    required this.signature,
    required this.timestamp,
    required this.apiKey,
    required this.cloudName,
    required this.folder,
    required this.publicId,
    required this.uploadUrl,
  });

  factory CloudinarySignature.fromJson(Map<String, dynamic> json) =>
      CloudinarySignature(
        uploadSessionId: json['upload_session_id'] as String?,
        overwrite: json['overwrite'] as bool?,
        signature: json['signature'] as String,
        timestamp: json['timestamp'] as int,
        apiKey: json['api_key'] as String,
        cloudName: json['cloud_name'] as String,
        folder: json['folder'] as String,
        publicId: json['public_id'] as String,
        uploadUrl: json['upload_url'] as String,
      );
}
