import 'package:flutter_test/flutter_test.dart';
import 'package:omlu/core/models.dart';

void main() {
  group('Models Serialization', () {
    test('User serialization and copyWith', () {
      final json = {
        'id': 'user-123',
        'email': 'alice@example.com',
        'username': 'alice',
        'display_name': 'Alice Wonderland',
        'avatar_url': 'https://res.cloudinary.com/test.jpg',
        'bio': 'A photographer',
        'created_at': '2026-09-24T00:00:00Z',
      };

      final user = User.fromJson(json);
      expect(user.id, equals('user-123'));
      expect(user.username, equals('alice'));
      expect(user.displayName, equals('Alice Wonderland'));
      expect(user.bio, equals('A photographer'));

      final updated = user.copyWith(displayName: 'Alice C.');
      expect(updated.displayName, equals('Alice C.'));
      expect(updated.email, equals(user.email));

      expect(user.toJson()['id'], equals('user-123'));
    });

    test('Space serialization', () {
      final json = {
        'id': 'space-456',
        'name': 'Trip 2026',
        'description': 'Summer vacation',
        'cover_url': null,
        'owner_id': 'user-123',
        'invite_code': 'ABC-123-XYZ',
        'members_count': 5,
        'memories_count': 24,
        'is_owner': true,
        'is_member': true,
        'created_at': '2026-09-24T00:00:00Z',
      };

      final space = Space.fromJson(json);
      expect(space.id, equals('space-456'));
      expect(space.name, equals('Trip 2026'));
      expect(space.membersCount, equals(5));
      expect(space.isOwner, isTrue);
    });

    test('MediaItem aspect ratio calculation', () {
      const media = MediaItem(
        id: 'media-1',
        cloudinaryPublicId: 'pub_123',
        secureUrl: 'https://cloudinary.com/pic.jpg',
        width: 1200,
        height: 800,
        position: 0,
      );

      expect(media.aspectRatio, equals(1.5));
    });

    test('Memory serialization', () {
      final json = {
        'id': 'mem-1',
        'client_id': 'cid-1',
        'space_id': 'space-456',
        'space_name': 'Trip 2026',
        'author_id': 'user-123',
        'author_username': 'alice',
        'author_display_name': 'Alice',
        'author_avatar_url': null,
        'caption': 'Sunset glow',
        'memory_date': '2026-09-24',
        'created_at': '2026-09-24T18:00:00Z',
        'media_items': [
          {
            'cloudinary_public_id': 'pub_123',
            'secure_url': 'https://cloudinary.com/pic.jpg',
            'position': 0,
            'width': 1000,
            'height': 1000,
          }
        ],
        'likes_count': 3,
        'is_liked_by_me': false,
        'comments_count': 1,
        'notes': [],
        'can_delete': true,
      };

      final memory = Memory.fromJson(json);
      expect(memory.id, equals('mem-1'));
      expect(memory.caption, equals('Sunset glow'));
      expect(memory.mediaItems.length, equals(1));
      expect(memory.mediaItems.first.width, equals(1000));
    });
  });
}
