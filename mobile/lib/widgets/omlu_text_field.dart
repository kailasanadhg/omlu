import 'package:flutter/material.dart';
import 'package:omlu/core/design_system.dart';

class OmluTextField extends StatefulWidget {
  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? errorText;
  final bool isPassword;
  final TextInputType keyboardType;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final bool autofocus;
  final int maxLines;

  const OmluTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.errorText,
    this.isPassword = false,
    this.keyboardType = TextInputType.text,
    this.textInputAction = TextInputAction.done,
    this.onChanged,
    this.onSubmitted,
    this.prefixIcon,
    this.suffixIcon,
    this.autofocus = false,
    this.maxLines = 1,
  });

  @override
  State<OmluTextField> createState() => _OmluTextFieldState();
}

class _OmluTextFieldState extends State<OmluTextField> {
  bool _obscureText = true;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.isPassword;
  }

  @override
  Widget build(BuildContext context) {
    Widget? actualSuffixIcon = widget.suffixIcon;

    if (widget.isPassword) {
      actualSuffixIcon = IconButton(
        icon: Icon(
          _obscureText ? Icons.visibility_off : Icons.visibility,
          color: OmluColors.secondary,
        ),
        onPressed: () {
          setState(() {
            _obscureText = !_obscureText;
          });
        },
        splashRadius: 20,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: OmluTypography.inputLabel,
          ),
          const SizedBox(height: OmluSpacing.xs),
        ],
        TextField(
          controller: widget.controller,
          obscureText: _obscureText,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          onChanged: widget.onChanged,
          onSubmitted: widget.onSubmitted,
          autofocus: widget.autofocus,
          maxLines: widget.isPassword ? 1 : widget.maxLines,
          style: OmluTypography.bodyLarge,
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: OmluTypography.bodyLarge.copyWith(color: OmluColors.textTertiary),
            errorText: widget.errorText,
            prefixIcon: widget.prefixIcon,
            suffixIcon: actualSuffixIcon,
            filled: true,
            fillColor: OmluColors.surface,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: OmluSpacing.md,
              vertical: OmluSpacing.md,
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
              borderSide: const BorderSide(color: OmluColors.primary),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(OmluRadii.md),
              borderSide: const BorderSide(color: OmluColors.error),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(OmluRadii.md),
              borderSide: const BorderSide(color: OmluColors.error),
            ),
          ),
        ),
      ],
    );
  }
}
