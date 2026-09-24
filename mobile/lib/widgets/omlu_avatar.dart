import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/core/design_system.dart';

enum OmluAvatarSize {
  xs(OmluSizes.avatarXs),
  sm(OmluSizes.avatarSm),
  md(OmluSizes.avatarMd),
  lg(OmluSizes.avatarLg),
  xl(OmluSizes.avatarXl);

  final double value;
  const OmluAvatarSize(this.value);
}

class OmluAvatar extends StatelessWidget {
  final String? imageUrl;
  final String? displayName;
  final OmluAvatarSize size;
  final bool showBorder;
  final VoidCallback? onTap;

  const OmluAvatar({
    super.key,
    this.imageUrl,
    this.displayName,
    this.size = OmluAvatarSize.md,
    this.showBorder = false,
    this.onTap,
  });

  String get _initials {
    if (displayName == null || displayName!.trim().isEmpty) return '?';
    final parts = displayName!.trim().split(' ');
    if (parts.length > 1) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final double dimension = size.value;
    final borderRadius = BorderRadius.circular(OmluRadii.full);

    Widget avatarContent = Container(
      width: dimension,
      height: dimension,
      decoration: BoxDecoration(
        color: OmluColors.tertiary,
        borderRadius: borderRadius,
        border: showBorder
            ? Border.all(color: OmluColors.borderLight, width: 2.0)
            : null,
      ),
      alignment: Alignment.center,
      child: imageUrl != null && imageUrl!.isNotEmpty
          ? ClipRRect(
              borderRadius: borderRadius,
              child: CachedNetworkImage(
                imageUrl: OmluImageTransform.optimize(imageUrl, type: 'avatar'),
                width: dimension,
                height: dimension,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(color: OmluColors.tertiary),
                errorWidget: (context, url, error) => _buildInitials(),
              ),
            )
          : _buildInitials(),
    );

    avatarContent = Semantics(
      label: displayName != null ? 'Avatar for $displayName' : 'User avatar',
      image: true,
      child: avatarContent,
    );

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        child: avatarContent,
      );
    }

    return avatarContent;
  }

  Widget _buildInitials() {
    return Text(
      _initials,
      style: OmluTypography.sectionHeader.copyWith(
        color: OmluColors.textInverse,
        fontSize: size.value * 0.4,
      ),
    );
  }
}
