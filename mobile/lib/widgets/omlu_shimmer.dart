import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import 'package:omlu/core/design_system.dart';

class _BaseShimmer extends StatelessWidget {
  final Widget child;

  const _BaseShimmer({required this.child});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: OmluColors.shimmerBase,
      highlightColor: OmluColors.shimmerHighlight,
      child: child,
    );
  }
}

class ShimmerBox extends StatelessWidget {
  final double? width;
  final double? height;
  final BorderRadiusGeometry borderRadius;

  const ShimmerBox({
    super.key,
    this.width,
    this.height,
    this.borderRadius = const BorderRadius.all(Radius.circular(OmluRadii.xs)),
  });

  @override
  Widget build(BuildContext context) {
    return _BaseShimmer(
      child: Container(
        width: width ?? double.infinity,
        height: height ?? double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: borderRadius,
        ),
      ),
    );
  }
}

class ShimmerCircle extends StatelessWidget {
  final double size;

  const ShimmerCircle({super.key, required this.size});

  @override
  Widget build(BuildContext context) {
    return _BaseShimmer(
      child: Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

class ShimmerLine extends StatelessWidget {
  final double width;
  final double height;

  const ShimmerLine({
    super.key,
    required this.width,
    this.height = 14.0,
  });

  @override
  Widget build(BuildContext context) {
    return _BaseShimmer(
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(height / 2),
        ),
      ),
    );
  }
}

class FeedCardShimmer extends StatelessWidget {
  const FeedCardShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: OmluSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: OmluSpacing.md),
            child: Row(
              children: [
                const ShimmerCircle(size: OmluSizes.avatarMd),
                const SizedBox(width: OmluSpacing.sm),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    ShimmerLine(width: 120),
                    SizedBox(height: OmluSpacing.xs),
                    ShimmerLine(width: 80, height: 10),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: OmluSpacing.md),
          const AspectRatio(
            aspectRatio: 1.0,
            child: ShimmerBox(borderRadius: BorderRadius.zero),
          ),
          const SizedBox(height: OmluSpacing.sm),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: OmluSpacing.md),
            child: const ShimmerLine(width: 200),
          ),
        ],
      ),
    );
  }
}

class MasonryShimmer extends StatelessWidget {
  final double height;
  
  const MasonryShimmer({super.key, required this.height});

  @override
  Widget build(BuildContext context) {
    return ShimmerBox(
      height: height,
      borderRadius: BorderRadius.circular(OmluRadii.md),
    );
  }
}
