
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_translations' AND column_name = 'seo_content_html') THEN
        ALTER TABLE product_translations ADD COLUMN seo_content_html TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'category_translations' AND column_name = 'seo_content_html') THEN
        ALTER TABLE category_translations ADD COLUMN seo_content_html TEXT;
    END IF;
END $$;
