import 'package:flutter/material.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';
import 'package:cached_network_image/cached_network_image.dart';

class SpaceCircles extends StatelessWidget {
  final List<Space> spaces;
  final VoidCallback onCreateSpace;
  final void Function(Space) onSpaceTap;

  const SpaceCircles({
    super.key,
    required this.spaces,
    required this.onCreateSpace,
    required this.onSpaceTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 104,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: OmluSpacing.md),
        itemCount: spaces.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return _buildCreateSpaceBtn();
          }
          final space = spaces[index - 1];
          return _buildSpaceItem(space);
        },
      ),
    );
  }

  Widget _buildCreateSpaceBtn() {
    return Padding(
      padding: const EdgeInsets.only(right: OmluSpacing.sm),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          GestureDetector(
            onTap: onCreateSpace,
            child: SizedBox(
              width: OmluSizes.avatarLg,
              height: OmluSizes.avatarLg,
              child: CustomPaint(
                painter: _DashedCirclePainter(
                  color: OmluColors.border,
                  strokeWidth: 2,
                ),
                child: const Center(
                  child: Icon(
                    Icons.add,
                    color: OmluColors.textPrimary,
                    size: OmluSizes.iconMd,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: OmluSpacing.xs),
          const Text(
            '+ Space',
            style: OmluTypography.navLabel,
          ),
        ],
      ),
    );
  }

  Widget _buildSpaceItem(Space space) {
    final coverUrl = space.coverUrl;
    final imageUrl = coverUrl != null 
        ? OmluImageTransform.optimize(coverUrl, type: 'avatar')
        : null;

    return Padding(
      padding: const EdgeInsets.only(right: OmluSpacing.sm),
      child: GestureDetector(
        onTap: () => onSpaceTap(space),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: OmluSizes.avatarLg,
              height: OmluSizes.avatarLg,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: OmluColors.primary,
                  width: 2,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(2.0),
                child: ClipOval(
                  child: imageUrl != null
                      ? CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(color: OmluColors.shimmerBase),
                          errorWidget: (context, url, error) => Container(color: OmluColors.shimmerBase),
                        )
                      : Container(
                          color: OmluColors.tertiary,
                          alignment: Alignment.center,
                          child: Text(
                            space.name.isNotEmpty ? space.name[0].toUpperCase() : '?',
                            style: OmluTypography.sectionHeader,
                          ),
                        ),
                ),
              ),
            ),
            const SizedBox(height: OmluSpacing.xs),
            SizedBox(
              width: OmluSizes.avatarLg,
              child: Text(
                space.name,
                style: OmluTypography.navLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DashedCirclePainter extends CustomPainter {
  final Color color;
  final double strokeWidth;

  _DashedCirclePainter({required this.color, required this.strokeWidth});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    const dashWidth = 6.0;
    const dashSpace = 4.0;
    
    final radius = size.width / 2;
    final circumference = 2 * 3.1415926535 * radius;
    final dashCount = (circumference / (dashWidth + dashSpace)).floor();
    final sweepAngle = (dashWidth / circumference) * 2 * 3.1415926535;
    final gapAngle = (dashSpace / circumference) * 2 * 3.1415926535;

    for (int i = 0; i < dashCount; i++) {
      final startAngle = i * (sweepAngle + gapAngle);
      canvas.drawArc(
        Rect.fromCircle(center: Offset(radius, radius), radius: radius),
        startAngle,
        sweepAngle,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
