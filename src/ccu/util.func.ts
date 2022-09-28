export function getIndexFromChannelAddress(address: string): string{
    const tokens=address.toLowerCase().split(':');
    return tokens.length > 0 ? tokens[tokens.length-1] : '';
}