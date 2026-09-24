import 'package:flutter/material.dart';
import 'package:omlu/core/design_system.dart';
import 'omlu_button.dart';

class OmluEmptyState extends StatefulWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final String? primaryActionText;
  final VoidCallback? onPrimaryAction;
  final String? secondaryActionText;
  final VoidCallback? onSecondaryAction;

  const OmluEmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.primaryActionText,
    this.onPrimaryAction,
    this.secondaryActionText,
    this.onSecondaryAction,
  });

  @override
  State<OmluEmptyState> createState() => _OmluEmptyStateState();
}

class _OmluEmptyStateState extends State<OmluEmptyState> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: OmluDurations.normal,
    );
    _opacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: OmluCurves.enter),
    );
    _slide = Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: OmluCurves.enter),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(
        position: _slide,
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(OmluSpacing.xxl),
            child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                widget.icon,
                size: OmluSizes.iconXl * 1.5,
                color: OmluColors.secondaryLight,
              ),
              const SizedBox(height: OmluSpacing.lg),
              Text(
                widget.title,
                style: OmluTypography.sectionHeader,
                textAlign: TextAlign.center,
              ),
              if (widget.subtitle != null) ...[
                const SizedBox(height: OmluSpacing.xs),
                Text(
                  widget.subtitle!,
                  style: OmluTypography.body,
                  textAlign: TextAlign.center,
                ),
              ],
              if (widget.primaryActionText != null && widget.onPrimaryAction != null) ...[
                const SizedBox(height: OmluSpacing.xl),
                OmluButton(
                  text: widget.primaryActionText!,
                  onPressed: widget.onPrimaryAction,
                  variant: OmluButtonVariant.primary,
                ),
              ],
              if (widget.secondaryActionText != null && widget.onSecondaryAction != null) ...[
                const SizedBox(height: OmluSpacing.md),
                OmluButton(
                  text: widget.secondaryActionText!,
                  onPressed: widget.onSecondaryAction,
                  variant: OmluButtonVariant.ghost,
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
  }
}
