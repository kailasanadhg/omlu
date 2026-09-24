/// OMLU Date Formatting Utilities
library;

import 'package:intl/intl.dart';

String formatMemoryDate(String dateStr) {
  try {
    final d = DateTime.parse(dateStr);
    final formatted = DateFormat('MMM yyyy').format(d);
    return 'A memory from $formatted';
  } catch (_) {
    return dateStr;
  }
}

String formatFullDate(String dateStr) {
  try {
    final d = DateTime.parse(dateStr);
    return DateFormat('MMMM d, yyyy').format(d);
  } catch (_) {
    return dateStr;
  }
}

String formatRelativeTime(String dateStr) {
  try {
    final now = DateTime.now();
    final d = DateTime.parse(dateStr);
    final diff = now.difference(d);

    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return DateFormat('MMM d').format(d);
  } catch (_) {
    return '';
  }
}

String formatShortDate(String dateStr) {
  try {
    final d = DateTime.parse(dateStr);
    return DateFormat('MMM d, yyyy').format(d);
  } catch (_) {
    return dateStr;
  }
}
