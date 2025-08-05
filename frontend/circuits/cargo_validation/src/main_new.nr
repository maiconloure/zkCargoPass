// Circuit to verify cargo values match declared totals
fn main(
    quantity1: u64, 
    unit_value1: u64,
    quantity2: u64,
    unit_value2: u64,
    total_declared_value: pub u64
) {
    let sum1 = quantity1 * unit_value1;
    let sum2 = quantity2 * unit_value2; 
    let total_sum = sum1 + sum2;
    
    assert(total_sum == total_declared_value);
}

#[test]  
fn test_example_data() {
    // Example: 100×400 + 200×20 = 44000
    main(100, 400, 200, 20, 44000);
}
