import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';

class MasonryPhotoCell extends StatelessWidget {
  final Memory memory;
  final VoidCallback onTap;

  const MasonryPhotoCell({
    super.key,
    required this.memory,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (memory.mediaItems.isEmpty) return const SizedBox.shrink();
    
    final mediaItem = memory.mediaItems.first;
    final url = OmluImageTransform.optimize(mediaItem.secureUrl, type: 'masonry');
    final aspectRatio = mediaItem.aspectRatio;

    return ClipRRect(
      borderRadius: BorderRadius.circular(OmluRadii.xs),
      child: AspectRatio(
        aspectRatio: aspectRatio,
        child: Stack(
          fit: StackFit.expand,
          children: [
            CachedNetworkImage(
              imageUrl: url,
              fit: BoxFit.cover,
              placeholder: (context, url) => Container(
                color: OmluColors.shimmerBase,
              ),
              errorWidget: (context, url, error) => Container(
                color: OmluColors.shimmerBase,
                child: const Icon(Icons.error, color: OmluColors.secondary),
              ),
            ),
            // Gradient overlay
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 48,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.6),
                    ],
                  ),
                ),
              ),
            ),
            // Labels
            Positioned(
              left: OmluSpacing.xs,
              bottom: OmluSpacing.xs,
              right: OmluSpacing.xs,
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      memory.spaceName,
                      style: OmluTypography.metadata.copyWith(
                        color: OmluColors.textInverse,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (memory.isLikedByMe) ...[
                    const SizedBox(width: OmluSpacing.xxs),
                    const Icon(
                      Icons.favorite,
                      color: OmluColors.like,
                      size: 14,
                    ),
                  ],
                ],
              ),
            ),
            Positioned.fill(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onTap,
                  splashColor: OmluColors.scrimLight,
                  highlightColor: Colors.transparent,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
