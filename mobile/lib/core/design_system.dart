/// OMLU Design System — Design Tokens
///
/// Centralized visual foundation for the entire OMLU application.
/// All colors, typography, spacing, radii, and animation values
/// are defined here. No screen should define its own magic numbers.
library;

import 'package:flutter/material.dart';

// ─────────────────────────── COLORS ───────────────────────────

class OmluColors {
  OmluColors._();

  // Core palette
  static const Color background = Color(0xFFF7F5F0);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color primary = Color(0xFF171717);
  static const Color primaryLight = Color(0xFF2D2D2D);
  static const Color secondary = Color(0xFF8A8A8A);
  static const Color secondaryLight = Color(0xFFB0B0B0);
  static const Color tertiary = Color(0xFFD4D0C8);
  
  // Text
  static const Color textPrimary = Color(0xFF171717);
  static const Color textSecondary = Color(0xFF6B6B6B);
  static const Color textTertiary = Color(0xFF9E9E9E);
  static const Color textInverse = Color(0xFFFFFFFF);
  
  // Photo surfaces
  static const Color photoSurface = Color(0xFF0A0A0A);
  static const Color photoSurfaceLight = Color(0xFF1A1A1A);
  
  // Semantic
  static const Color error = Color(0xFFDC3545);
  static const Color errorLight = Color(0xFFFFF0F0);
  static const Color success = Color(0xFF28A745);
  static const Color successLight = Color(0xFFF0FFF4);
  static const Color warning = Color(0xFFE5A100);
  
  // Interactive
  static const Color like = Color(0xFFE84057);
  static const Color linkBlue = Color(0xFF2563EB);
  
  // Dividers & borders
  static const Color divider = Color(0xFFEBE8E0);
  static const Color border = Color(0xFFE0DCD4);
  static const Color borderLight = Color(0xFFF0EDE6);
  
  // Shimmer
  static const Color shimmerBase = Color(0xFFEBE8E0);
  static const Color shimmerHighlight = Color(0xFFF7F5F0);
  
  // Overlay
  static const Color scrim = Color(0x80000000);
  static const Color scrimLight = Color(0x33000000);
}

// ─────────────────────────── SPACING ───────────────────────────

class OmluSpacing {
  OmluSpacing._();

  static const double xxxs = 2.0;
  static const double xxs = 4.0;
  static const double xs = 8.0;
  static const double sm = 12.0;
  static const double md = 16.0;
  static const double lg = 20.0;
  static const double xl = 24.0;
  static const double xxl = 32.0;
  static const double xxxl = 40.0;
  static const double huge = 48.0;
  static const double massive = 64.0;

  // Grid spacing for masonry
  static const double gridGap = 3.0;
  static const double gridPadding = 3.0;
}

// ─────────────────────────── RADII ───────────────────────────

class OmluRadii {
  OmluRadii._();

  static const double none = 0.0;
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double full = 999.0;
}

// ─────────────────────────── DURATIONS ───────────────────────────

class OmluDurations {
  OmluDurations._();

  static const Duration instant = Duration(milliseconds: 50);
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 350);
  static const Duration page = Duration(milliseconds: 300);
}

// ─────────────────────────── CURVES ───────────────────────────

class OmluCurves {
  OmluCurves._();

  static const Curve standard = Curves.easeInOut;
  static const Curve enter = Curves.easeOut;
  static const Curve exit = Curves.easeIn;
  static const Curve spring = Curves.elasticOut;
  static const Curve decelerate = Curves.decelerate;
}

// ─────────────────────────── TYPOGRAPHY ───────────────────────────

class OmluTypography {
  OmluTypography._();

  static const String _fontFamily = 'SF Pro Display';
  static const String _fontFamilyBody = 'SF Pro Text';

  // Display — hero headlines
  static const TextStyle display = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 28,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.5,
    height: 1.2,
    color: OmluColors.textPrimary,
  );

  // Page title
  static const TextStyle pageTitle = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 22,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.3,
    height: 1.25,
    color: OmluColors.textPrimary,
  );

  // Space title
  static const TextStyle spaceTitle = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    height: 1.3,
    color: OmluColors.textPrimary,
  );

  // Section header
  static const TextStyle sectionHeader = TextStyle(
    fontFamily: _fontFamily,
    fontSize: 15,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
    height: 1.35,
    color: OmluColors.textPrimary,
  );

  // Body large
  static const TextStyle bodyLarge = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 16,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.5,
    color: OmluColors.textPrimary,
  );

  // Body
  static const TextStyle body = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.5,
    color: OmluColors.textPrimary,
  );

  // Body small
  static const TextStyle bodySmall = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 13,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.4,
    color: OmluColors.textSecondary,
  );

  // Caption
  static const TextStyle caption = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.1,
    height: 1.4,
    color: OmluColors.textTertiary,
  );

  // Metadata
  static const TextStyle metadata = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 11,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.2,
    height: 1.4,
    color: OmluColors.textTertiary,
  );

  // Button
  static const TextStyle button = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 15,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
    height: 1.2,
  );

  // Button small
  static const TextStyle buttonSmall = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
    height: 1.2,
  );

  // Input label
  static const TextStyle inputLabel = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 13,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.1,
    height: 1.4,
    color: OmluColors.textSecondary,
  );

  // Nav label
  static const TextStyle navLabel = TextStyle(
    fontFamily: _fontFamilyBody,
    fontSize: 10,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.2,
    height: 1.2,
  );
}

// ─────────────────────────── SIZES ───────────────────────────

class OmluSizes {
  OmluSizes._();

  // Icons
  static const double iconXs = 16.0;
  static const double iconSm = 20.0;
  static const double iconMd = 24.0;
  static const double iconLg = 28.0;
  static const double iconXl = 32.0;

  // Avatars
  static const double avatarXs = 24.0;
  static const double avatarSm = 32.0;
  static const double avatarMd = 40.0;
  static const double avatarLg = 56.0;
  static const double avatarXl = 80.0;

  // Touch targets
  static const double touchTarget = 48.0;
  static const double touchTargetSm = 40.0;

  // Navigation
  static const double bottomNavHeight = 56.0;
  static const double topBarHeight = 52.0;

  // Camera
  static const double shutterButton = 72.0;
  static const double shutterButtonInner = 60.0;
}

// ─────────────────────────── IMAGE HELPERS ───────────────────────────

class OmluImageTransform {
  OmluImageTransform._();

  /// Inject Cloudinary on-the-fly transformations into delivery URLs.
  static String optimize(String? url, {String type = 'feed'}) {
    if (url == null || url.isEmpty) return '';
    if (!url.contains('/image/upload/')) return url;
    if (url.contains('/image/upload/f_auto') ||
        url.contains('/image/upload/c_') ||
        url.contains('/image/upload/w_')) {
      return url;
    }

    const transformations = {
      'feed': 'f_auto,q_auto,w_1080,c_limit',
      'grid': 'f_auto,q_auto,w_400,h_400,c_fill',
      'masonry': 'f_auto,q_auto,w_600,c_limit',
      'avatar': 'f_auto,q_auto,w_200,h_200,c_fill',
      'cover': 'f_auto,q_auto,w_1200,h_600,c_fill',
      'full': 'f_auto,q_auto',
      'thumb': 'f_auto,q_auto,w_300,c_limit',
    };

    final transform = transformations[type] ?? 'f_auto,q_auto';
    return url.replaceFirst('/image/upload/', '/image/upload/$transform/');
  }
}

// ─────────────────────────── RESPONSIVE ───────────────────────────

class OmluBreakpoints {
  OmluBreakpoints._();

  static const double compactPhone = 320.0;
  static const double phone = 375.0;
  static const double largePhone = 414.0;
  static const double tablet = 600.0;
  static const double largeTablet = 900.0;

  /// Determine masonry column count based on available width.
  static int masonryColumns(double width) {
    if (width < 400) return 2;
    if (width < 600) return 2;
    if (width < 800) return 3;
    if (width < 1100) return 4;
    return 5;
  }
}
