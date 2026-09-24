/// OMLU Flutter Theme
///
/// Creates the MaterialApp theme using the OMLU design system tokens.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:omlu/core/design_system.dart';

ThemeData omluTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: OmluColors.background,
    colorScheme: const ColorScheme.light(
      primary: OmluColors.primary,
      onPrimary: OmluColors.textInverse,
      secondary: OmluColors.secondary,
      surface: OmluColors.surface,
      onSurface: OmluColors.textPrimary,
      error: OmluColors.error,
      outline: OmluColors.border,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: OmluColors.background,
      foregroundColor: OmluColors.textPrimary,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: OmluTypography.spaceTitle,
      systemOverlayStyle: SystemUiOverlayStyle(
        statusBarBrightness: Brightness.light,
        statusBarIconBrightness: Brightness.dark,
        statusBarColor: Colors.transparent,
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: OmluColors.surface,
      selectedItemColor: OmluColors.primary,
      unselectedItemColor: OmluColors.secondaryLight,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
      selectedLabelStyle: OmluTypography.navLabel,
      unselectedLabelStyle: OmluTypography.navLabel,
      showSelectedLabels: true,
      showUnselectedLabels: true,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: OmluColors.surface,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: OmluSpacing.md,
        vertical: OmluSpacing.sm,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(OmluRadii.md),
        borderSide: const BorderSide(color: OmluColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(OmluRadii.md),
        borderSide: const BorderSide(color: OmluColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(OmluRadii.md),
        borderSide: const BorderSide(color: OmluColors.primary, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(OmluRadii.md),
        borderSide: const BorderSide(color: OmluColors.error),
      ),
      hintStyle: OmluTypography.body.copyWith(color: OmluColors.textTertiary),
      labelStyle: OmluTypography.inputLabel,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: OmluColors.primary,
        foregroundColor: OmluColors.textInverse,
        elevation: 0,
        textStyle: OmluTypography.button,
        padding: const EdgeInsets.symmetric(
          horizontal: OmluSpacing.xl,
          vertical: OmluSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(OmluRadii.md),
        ),
        minimumSize: const Size(0, OmluSizes.touchTarget),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: OmluColors.primary,
        elevation: 0,
        textStyle: OmluTypography.button,
        padding: const EdgeInsets.symmetric(
          horizontal: OmluSpacing.xl,
          vertical: OmluSpacing.sm,
        ),
        side: const BorderSide(color: OmluColors.border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(OmluRadii.md),
        ),
        minimumSize: const Size(0, OmluSizes.touchTarget),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: OmluColors.primary,
        textStyle: OmluTypography.button,
        padding: const EdgeInsets.symmetric(
          horizontal: OmluSpacing.md,
          vertical: OmluSpacing.xs,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: OmluColors.divider,
      thickness: 0.5,
      space: 0,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: OmluColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(OmluRadii.xl),
        ),
      ),
      showDragHandle: true,
      dragHandleColor: OmluColors.tertiary,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: OmluColors.primary,
      contentTextStyle: OmluTypography.bodySmall.copyWith(
        color: OmluColors.textInverse,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(OmluRadii.sm),
      ),
      behavior: SnackBarBehavior.floating,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: OmluColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(OmluRadii.lg),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: OmluColors.primary,
      linearTrackColor: OmluColors.divider,
    ),
  );
}
