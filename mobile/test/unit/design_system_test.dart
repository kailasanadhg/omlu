import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omlu/core/design_system.dart';

void main() {
  group('Design System Tokens', () {
    test('Palette foundation matches spec', () {
      expect(OmluColors.background, equals(const Color(0xFFF7F5F0)));
      expect(OmluColors.primary, equals(const Color(0xFF171717)));
      expect(OmluColors.photoSurface, equals(const Color(0xFF0A0A0A)));
    });

    test('Responsive masonry column breakpoints', () {
      expect(OmluBreakpoints.masonryColumns(350), equals(2));
      expect(OmluBreakpoints.masonryColumns(500), equals(2));
      expect(OmluBreakpoints.masonryColumns(700), equals(3));
      expect(OmluBreakpoints.masonryColumns(950), equals(4));
      expect(OmluBreakpoints.masonryColumns(1200), equals(5));
    });

    test('Image transform injection for Cloudinary URLs', () {
      const rawUrl = 'https://res.cloudinary.com/omlu/image/upload/sample.jpg';
      final feedOptimized = OmluImageTransform.optimize(rawUrl, type: 'feed');
      expect(feedOptimized, contains('/image/upload/f_auto,q_auto,w_1080,c_limit/sample.jpg'));

      final gridOptimized = OmluImageTransform.optimize(rawUrl, type: 'grid');
      expect(gridOptimized, contains('/image/upload/f_auto,q_auto,w_400,h_400,c_fill/sample.jpg'));

      final avatarOptimized = OmluImageTransform.optimize(rawUrl, type: 'avatar');
      expect(avatarOptimized, contains('/image/upload/f_auto,q_auto,w_200,h_200,c_fill/sample.jpg'));

      // Non-cloudinary URLs should not be transformed
      const nonCloudinary = 'https://images.unsplash.com/photo-1234';
      expect(OmluImageTransform.optimize(nonCloudinary), equals(nonCloudinary));

      // Null or empty URLs should return empty string
      expect(OmluImageTransform.optimize(null), equals(''));
      expect(OmluImageTransform.optimize(''), equals(''));
    });
  });
}
