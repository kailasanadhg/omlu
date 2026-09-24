import 'package:flutter_test/flutter_test.dart';
import 'package:omlu/core/date_utils.dart';

void main() {
  group('Date Utilities', () {
    test('formatMemoryDate returns formatted string', () {
      final formatted = formatMemoryDate('2026-09-24T12:00:00Z');
      expect(formatted, equals('A memory from Sep 2026'));
    });

    test('formatMemoryDate handles invalid dates gracefully', () {
      final formatted = formatMemoryDate('invalid-date');
      expect(formatted, equals('invalid-date'));
    });

    test('formatFullDate formats full month, day and year', () {
      final formatted = formatFullDate('2026-09-24T12:00:00Z');
      expect(formatted, equals('September 24, 2026'));
    });

    test('formatShortDate formats abbreviated month, day and year', () {
      final formatted = formatShortDate('2026-09-24T12:00:00Z');
      expect(formatted, equals('Sep 24, 2026'));
    });

    test('formatRelativeTime returns just now for immediate past', () {
      final now = DateTime.now().toIso8601String();
      final formatted = formatRelativeTime(now);
      expect(formatted, equals('just now'));
    });
  });
}
