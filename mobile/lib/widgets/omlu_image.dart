import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/core/design_system.dart';
import 'omlu_shimmer.dart';

class OmluImage extends StatelessWidget {
  final String imageUrl;
  final String imageType;
  final double? width;
  final double? height;
  final BoxFit fit;
  final BorderRadiusGeometry? borderRadius;

  const OmluImage({
    super.key,
    required this.imageUrl,
    this.imageType = 'feed',
    this.width,
    this.height,
    this.fit = BoxFit.cover,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final optimizedUrl = OmluImageTransform.optimize(imageUrl, type: imageType);

    Widget image = CachedNetworkImage(
      imageUrl: optimizedUrl,
      width: width,
      height: height,
      fit: fit,
      placeholder: (context, url) => const ShimmerBox(),
      errorWidget: (context, url, error) => Container(
        width: width,
        height: height,
        color: OmluColors.tertiary,
        child: const Center(
          child: Icon(Icons.broken_image, color: OmluColors.secondary),
        ),
      ),
      memCacheWidth: width != null ? (width! * 2).toInt() : null, // 2x density roughly
    );

    if (borderRadius != null) {
      return ClipRRect(
        borderRadius: borderRadius!,
        child: image,
      );
    }

    return image;
  }
}
