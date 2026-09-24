import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:omlu/core/design_system.dart';

enum OmluButtonVariant { primary, secondary, outline, danger, ghost }
enum OmluButtonSize { sm, md, lg }

class OmluButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final OmluButtonVariant variant;
  final OmluButtonSize size;
  final bool isLoading;
  final IconData? icon;

  const OmluButton({
    super.key,
    required this.text,
    this.onPressed,
    this.variant = OmluButtonVariant.primary,
    this.size = OmluButtonSize.md,
    this.isLoading = false,
    this.icon,
  });

  @override
  State<OmluButton> createState() => _OmluButtonState();
}

class _OmluButtonState extends State<OmluButton> {
  bool _isPressed = false;

  void _handleTapDown(TapDownDetails details) {
    if (widget.onPressed != null && !widget.isLoading) {
      HapticFeedback.lightImpact();
      setState(() => _isPressed = true);
    }
  }

  void _handleTapUp(TapUpDetails details) {
    if (widget.onPressed != null && !widget.isLoading) {
      setState(() => _isPressed = false);
    }
  }

  void _handleTapCancel() {
    if (widget.onPressed != null && !widget.isLoading) {
      setState(() => _isPressed = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isDisabled = widget.onPressed == null;
    final bool showLoading = widget.isLoading;

    Color backgroundColor;
    Color textColor;
    Border? border;

    switch (widget.variant) {
      case OmluButtonVariant.primary:
        backgroundColor = OmluColors.primary;
        textColor = OmluColors.textInverse;
        break;
      case OmluButtonVariant.secondary:
        backgroundColor = OmluColors.secondaryLight.withValues(alpha: 0.2);
        textColor = OmluColors.textPrimary;
        break;
      case OmluButtonVariant.outline:
        backgroundColor = Colors.transparent;
        textColor = OmluColors.textPrimary;
        border = Border.all(color: OmluColors.border, width: 1);
        break;
      case OmluButtonVariant.danger:
        backgroundColor = OmluColors.error;
        textColor = OmluColors.textInverse;
        break;
      case OmluButtonVariant.ghost:
        backgroundColor = Colors.transparent;
        textColor = OmluColors.textPrimary;
        break;
    }

    if (isDisabled && !showLoading) {
      backgroundColor = OmluColors.tertiary.withValues(alpha: 0.5);
      textColor = OmluColors.textTertiary;
      border = null;
    }

    double height;
    TextStyle textStyle;
    EdgeInsets padding;

    switch (widget.size) {
      case OmluButtonSize.sm:
        height = 32.0;
        textStyle = OmluTypography.buttonSmall;
        padding = const EdgeInsets.symmetric(horizontal: OmluSpacing.md);
        break;
      case OmluButtonSize.md:
        height = OmluSizes.touchTarget;
        textStyle = OmluTypography.button;
        padding = const EdgeInsets.symmetric(horizontal: OmluSpacing.lg);
        break;
      case OmluButtonSize.lg:
        height = 56.0;
        textStyle = OmluTypography.button.copyWith(fontSize: 16);
        padding = const EdgeInsets.symmetric(horizontal: OmluSpacing.xl);
        break;
    }

    // Ensure minimum touch target for accessibility
    final double actualHeight = height < OmluSizes.touchTarget ? OmluSizes.touchTarget : height;

    Widget content = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (showLoading)
          SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(textColor),
            ),
          )
        else if (widget.icon != null) ...[
          Icon(widget.icon, size: 18, color: textColor),
          const SizedBox(width: OmluSpacing.xs),
        ],
        if (showLoading && widget.text.isNotEmpty) const SizedBox(width: OmluSpacing.xs),
        if (!showLoading || widget.text.isNotEmpty)
          Text(
            widget.text,
            style: textStyle.copyWith(color: textColor),
          ),
      ],
    );

    return Semantics(
      button: true,
      enabled: !isDisabled,
      label: widget.text,
      child: GestureDetector(
        onTapDown: _handleTapDown,
        onTapUp: _handleTapUp,
        onTapCancel: _handleTapCancel,
        onTap: isDisabled || showLoading ? null : widget.onPressed,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: OmluDurations.fast,
          curve: OmluCurves.standard,
          height: actualHeight,
          padding: padding,
          decoration: BoxDecoration(
            color: _isPressed ? backgroundColor.withValues(alpha: 0.8) : backgroundColor,
            borderRadius: BorderRadius.circular(OmluRadii.full),
            border: border,
          ),
          alignment: Alignment.center,
          child: content,
        ),
      ),
    );
  }
}
