"""Preserve Inkclipse's invisible menu art while giving Ruffle an Up state.

The original buttons only define a HitTest state. Ruffle renders the menu but
does not dispatch their clicks. A separate Up record with zero alpha restores
clicks without painting the shared cyan hit-area shape over the menu text.
"""
import struct


class Bits:
    def __init__(self, data, position=0):
        self.data = data
        self.position = position * 8

    def read(self, count):
        value = 0
        for _ in range(count):
            value = (value << 1) | ((self.data[self.position // 8] >> (7 - self.position % 8)) & 1)
            self.position += 1
        return value

    def align(self):
        self.position = (self.position + 7) // 8 * 8

    def byte_position(self):
        return (self.position + 7) // 8

    def matrix(self):
        if self.read(1):
            self.read(self.read(5) * 2)
        if self.read(1):
            self.read(self.read(5) * 2)
        self.read(self.read(5) * 2)
        self.align()


def tags(data, position):
    while position + 2 <= len(data):
        start = position
        header = struct.unpack_from('<H', data, position)[0]
        position += 2
        kind, length = header >> 6, header & 63
        if length == 63:
            length = struct.unpack_from('<I', data, position)[0]
            position += 4
        end = position + length
        if end > len(data):
            raise ValueError('Truncated SWF tag')
        yield kind, data[position:end], data[start:position]
        position = end
        if kind == 0:
            break


def body_header_length(body):
    bits = Bits(body)
    bits.read(bits.read(5) * 4)
    return bits.byte_position() + 4


def button_records(tag):
    records = []
    position = 5
    while tag[position]:
        start = position
        flags = tag[position]
        if flags & 0x30:
            raise ValueError('Unexpected filters or blend mode in menu button')
        character = struct.unpack_from('<H', tag, position + 1)[0]
        bits = Bits(tag, position + 5)
        bits.matrix()
        color_start = bits.byte_position()
        add, multiply = bits.read(1), bits.read(1)
        width = bits.read(4)
        factors = [bits.read(width) for _ in range(4)] if multiply else None
        offsets = [bits.read(width) for _ in range(4)] if add else None
        bits.align()
        position = bits.byte_position()
        records.append({'flags': flags, 'character': character, 'raw': tag[start:position],
                        'prefix': tag[start:color_start], 'multipliers': factors, 'offsets': offsets})
    return records, position


def add_transparent_menu_states(body):
    # CXFORMWITHALPHA: no offsets, 10-bit multipliers RGB=256 (1), alpha=0.
    encoded = '01' + '1010' + ''.join(format(value, '010b') for value in (256, 256, 256, 0))
    encoded += '0' * (-len(encoded) % 8)
    transparent = bytes(int(encoded[index:index + 8], 2) for index in range(0, len(encoded), 8))
    changed = set()

    def rewrite(data, position):
        result = bytearray(data[:position])
        for kind, tag, header in tags(data, position):
            replacement = tag
            if kind == 39:
                replacement = rewrite(tag, 4)
            if kind == 34:
                button_id = struct.unpack_from('<H', tag)[0]
                if button_id in (42, 43):
                    records, end = button_records(tag)
                    if (button_id in changed or len(records) != 1 or records[0]['flags'] != 8
                            or records[0]['character'] != 41 or tag[3:5] != b'\0\0'):
                        raise ValueError('Inkclipse menu button layout changed')
                    hit = records[0]
                    up = b'\x01' + hit['prefix'][1:] + transparent
                    replacement = tag[:5] + up + hit['raw'] + tag[end:]
                    changed.add(button_id)
            if replacement == tag:
                result.extend(header)
            else:
                length = len(replacement)
                result.extend(struct.pack('<H', (kind << 6) | min(length, 63)))
                if length >= 63:
                    result.extend(struct.pack('<I', length))
            result.extend(replacement)
        return bytes(result)

    result = rewrite(body, body_header_length(body))
    if changed != {42, 43}:
        raise ValueError('Both Inkclipse menu buttons must be present')
    return result
